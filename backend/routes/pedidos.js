const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken, authorize } = require('./auth');
const { sendDeliveryNotifications, sendPickupNotification, sendPaymentConfirmationNotification, sendCookNotification, sendDeliveredConfirmationNotification, sendOrderCancellationNotification, sendOrderEditNotification } = require('../services/messageService');
const axios = require('axios');

// Função para enviar mensagem via WhatsApp usando a Z-API (com client-token no header)
async function sendWhatsAppMessageZApi(phone, message) {
  const cleanPhone = phone.replace(/\D/g, '');
  const zapApiToken = process.env.zapApiToken // SEU TOKEN
  const zapApiInstance = process.env.zapApiInstance // SUA INSTANCIA
  const zapApiClientToken = process.env.zapApiClientToken// Usando o token como client-token
  const zapApiUrl = `https://api.z-api.io/instances/${zapApiInstance}/token/${zapApiToken}/send-text`;

  await axios.post(
    zapApiUrl,
    {
      phone: `55${cleanPhone}`,
      message
    },
    {
      headers: {
        'client-token': zapApiClientToken
      }
    }
  );
}

// Rota para criar um pedido a partir do carrinho
router.post('/', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { paymentMethod, tipoEntrega, deliveryType, taxaEntrega, deliveryFee, notes, addressId, precisaTroco, valorTroco } = req.body;
    
    // Aceitar tanto deliveryType (do frontend) quanto tipoEntrega
    const tipo = deliveryType || tipoEntrega || 'delivery';
    
    // Aceitar tanto deliveryFee (do frontend) quanto taxaEntrega
    let taxa = deliveryFee || taxaEntrega || 0;
    
    if (!paymentMethod) {
        return res.status(400).json({ message: 'Forma de pagamento não informada.' });
    }
    console.log(`[POST /api/orders] Recebida requisição para criar um pedido. Usuário ID: ${userId}, Tipo: ${tipo}, Taxa: R$ ${taxa}${notes ? ', Observações: Sim' : ''}${addressId ? `, Endereço ID: ${addressId}` : ''}`);

    try {
        // Encontrar o carrinho e o usuário com seus endereços em uma única busca
        const [cart, user] = await Promise.all([
            prisma.carrinho.findUnique({
                where: { usuarioId: userId },
                include: {
                    itens: {
                        include: {
                            produto: true,
                            complementos: {
                                include: {
                                    complemento: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.usuario.findUnique({
                where: { id: userId },
                include: {
                    enderecos: true
                }
            })
        ]);

        if (!cart || cart.itens.length === 0) {
            console.warn(`[POST /api/orders] Carrinho do usuário ${userId} está vazio.`);
            return res.status(400).json({ message: 'Carrinho vazio. Adicione itens antes de criar um pedido.' });
        }

        // Para entrega, verificar se tem endereço
        let shippingAddress = null;
        if (tipo === 'delivery') {
            // Se foi fornecido um addressId, usar esse endereço específico
            if (addressId) {
                shippingAddress = user.enderecos.find(addr => addr.id === parseInt(addressId));
                if (!shippingAddress) {
                    console.warn(`[POST /api/orders] Endereço ID ${addressId} não encontrado para o usuário ${userId}.`);
                    return res.status(400).json({
                        message: 'Endereço selecionado não encontrado. Por favor, selecione um endereço válido.',
                        redirectPath: '/checkout'
                    });
                }
                console.log(`[POST /api/orders] Usando endereço selecionado ID: ${addressId}`);
            } else {
                // Fallback: usar endereço padrão ou o primeiro disponível
            shippingAddress = user.enderecos.find(addr => addr.padrao) || user.enderecos[0];
                console.log(`[POST /api/orders] Usando endereço padrão ou primeiro disponível`);
            }
            
            if (!shippingAddress) {
                console.warn(`[POST /api/orders] Usuário ${userId} não possui endereço de entrega cadastrado.`);
                return res.status(400).json({
                    message: 'Nenhum endereço de entrega encontrado. Por favor, cadastre um para continuar.',
                    redirectPath: '/api/auth/profile/enderecos'
                });
            }
        }
        
        // Calcular o preço total do pedido (SEM taxa de entrega ainda)
        const subprecoTotal = cart.itens.reduce((acc, item) => {
            // Verificar se é produto personalizado
            let itemPrice = item.produto.preco;
            if (item.opcoesSelecionadas) {
                if (item.opcoesSelecionadas.customAcai) {
                    itemPrice = item.opcoesSelecionadas.customAcai.value;
                } else if (item.opcoesSelecionadas.customSorvete) {
                    itemPrice = item.opcoesSelecionadas.customSorvete.value;
                } else if (item.opcoesSelecionadas.customProduct) {
                    itemPrice = item.opcoesSelecionadas.customProduct.value;
                }
            }
            return acc + (item.quantidade * itemPrice);
        }, 0);
        
        // Verificar se há promoção de frete grátis ativa
        let freteGratis = false;
        if (tipo === 'delivery' && taxa > 0) {
            const storeConfig = await prisma.configuracao_loja.findFirst();
            if (storeConfig && storeConfig.promocaoTaxaAtiva) {
                const hoje = new Date().getDay().toString(); // 0 = domingo, 1 = segunda, etc.
                const diasPromo = storeConfig.promocaoDias ? storeConfig.promocaoDias.split(',') : [];
                
                // Verificar se hoje é um dia de promoção
                if (diasPromo.includes(hoje)) {
                    const valorMinimo = parseFloat(storeConfig.promocaoValorMinimo || 0);
                    // Verificar se o subtotal atinge o valor mínimo
                    if (subprecoTotal >= valorMinimo) {
                        taxa = 0; // Frete grátis!
                        freteGratis = true;
                        console.log(`🎉 [POST /api/orders] PROMOÇÃO APLICADA! Frete grátis para pedido acima de R$ ${valorMinimo.toFixed(2)}. Subtotal: R$ ${subprecoTotal.toFixed(2)}`);
                    }
                }
            }
        }
        
        const precoTotal = subprecoTotal + (tipo === 'delivery' ? taxa : 0);

        console.log(`[POST /api/orders] Criando pedido para o usuário ${userId} com preço total de ${precoTotal.toFixed(2)} (${tipo}, Taxa: R$ ${taxa}${freteGratis ? ' - FRETE GRÁTIS' : ''}).`);

        // Determinar status inicial antes da transação
        const initialStatus = (paymentMethod === 'CREDIT_CARD' || paymentMethod === 'CASH_ON_DELIVERY') ? 'being_prepared' : 'pending_payment';
        
        // Iniciar uma transação para garantir que tudo seja feito ou nada seja feito
        const newOrder = await prisma.$transaction(async (tx) => {
            // 1. Criar o pedido, incluindo o telefone e o endereço de entrega
            // Se for cartão de crédito ou dinheiro na entrega, já inicia como "being_prepared", senão "pending_payment"
            
            const order = await tx.pedido.create({
                data: {
                    usuarioId: userId,
                    precoTotal: precoTotal,
                    status: initialStatus,
                    tipoEntrega: tipo,
                    taxaEntrega: tipo === 'delivery' ? taxa : 0,
                    metodoPagamento: paymentMethod,
                    observacoes: notes && notes.trim() ? notes.trim() : null,
                    precisaTroco: paymentMethod === 'CASH_ON_DELIVERY' ? (precisaTroco === true || precisaTroco === 'true') : false,
                    valorTroco: paymentMethod === 'CASH_ON_DELIVERY' && precisaTroco && valorTroco ? parseFloat(valorTroco) : null,
                    atualizadoEm: new Date(),
                    ruaEntrega: shippingAddress?.rua || null,
                    numeroEntrega: shippingAddress?.numero || null,
                    complementoEntrega: shippingAddress?.complemento || null,
                    bairroEntrega: shippingAddress?.bairro || null,
                },
                include: {
                    itens_pedido: true
                }
            });

            // 2. Criar os itens do pedido com seus complementos
            for (const item of cart.itens) {
                // Verificar se é produto personalizado
                let itemPrice = item.produto.preco;
                if (item.opcoesSelecionadas) {
                    if (item.opcoesSelecionadas.customAcai) {
                        itemPrice = item.opcoesSelecionadas.customAcai.value;
                    } else if (item.opcoesSelecionadas.customSorvete) {
                        itemPrice = item.opcoesSelecionadas.customSorvete.value;
                    } else if (item.opcoesSelecionadas.customProduct) {
                        itemPrice = item.opcoesSelecionadas.customProduct.value;
                    }
                }

                // Criar item do pedido
                const orderItem = await tx.item_pedido.create({
                    data: {
                        pedidoId: order.id,
                        produtoId: item.produtoId,
                        quantidade: item.quantidade,
                        precoNoPedido: itemPrice,
                        opcoesSelecionadasSnapshot: item.opcoesSelecionadas
                    }
                });

                // Adicionar complementos ao item do pedido
                if (item.complementos && item.complementos.length > 0) {
                    const complementData = item.complementos.map(c => ({
                        itemPedidoId: orderItem.id,
                        complementoId: c.complementoId,
                    }));

                    await tx.item_pedido_complemento.createMany({
                        data: complementData,
                    });

                    console.log(`🍓 [POST /api/orders] ${complementData.length} complementos adicionados ao item do pedido ${orderItem.id}.`);
                }
            }

            // 3. Criar o registro de pagamento
            await tx.pagamento.create({
                data: {
                    pedidoId: order.id,
                    valor: precoTotal,
                    metodo: paymentMethod,
                    status: (paymentMethod === 'CREDIT_CARD' || paymentMethod === 'CASH_ON_DELIVERY') ? 'PAID' : 'PENDING',
                    atualizadoEm: new Date()
                }
            });

            console.log(`💳 [POST /api/orders] Pagamento criado para o pedido ${order.id} com método ${paymentMethod}.`);

            // 4. Esvaziar o carrinho do usuário
            await tx.item_carrinho.deleteMany({
                where: { carrinhoId: cart.id }
            });

            return order;
        });

        console.log(`[POST /api/orders] Pedido ID ${newOrder.id} criado com sucesso para o usuário ${userId}.`);
        
        // Enviar mensagem via WhatsApp para PIX, Cartão de Crédito ou Dinheiro na Entrega
        const userData = await prisma.usuario.findUnique({ where: { id: req.user.id } });

        if ((paymentMethod === 'PIX' || paymentMethod === 'CREDIT_CARD' || paymentMethod === 'CASH_ON_DELIVERY') && userData.telefone) {
            const itens = cart.itens.map(item =>
                `• ${item.produto.nome} x ${item.quantidade}`
            ).join('\n');
            
            // Informações de entrega/retirada
            const deliveryInfo = tipo === 'pickup' 
                ? `📍 *Retirada no local*\n🏪 Endereço da loja: Açaidicasa, praça Geraldo Sá.\n` +
                `Localizaçao maps: https://maps.app.goo.gl/LGe84k24KogZWXMt6?g_st=ipc`
                : `*Entrega em casa*\n📍 Endereço: ${shippingAddress.rua}, ${shippingAddress.numero}${shippingAddress.complemento ? ` - ${shippingAddress.complemento}` : ''}\nBairro: ${shippingAddress.bairro}${shippingAddress.pontoReferencia ? `\n*Referência:* ${shippingAddress.pontoReferencia}` : ''}`;
            
            // Adicionar observações se houver
            const notesSection = notes && notes.trim() ? `\n\n📝 *Observações:*\n${notes.trim()}` : '';
            
            let message;
            
            if (paymentMethod === 'CREDIT_CARD') {
                message =
                    ` *Pedido Confirmado!* 🎉\n\n` +
                    ` *Pedido Nº:* ${newOrder.id}\n\n` +
                    ` *Itens:*\n${itens}\n\n` +
                    `💰 *Total:* R$ ${Number(newOrder.precoTotal).toFixed(2)}\n` +
                    `💳 *Forma de pagamento:* Cartão de Crédito\n\n` +
                    `${deliveryInfo}` +
                    notesSection + `\n\n` +
                    ` *Seu pedido já está sendo preparado!*\n` +
                    (tipo === 'pickup' ? ` Você pode retirar em breve!` : ` Em breve será enviado para entrega.`) + `\n\n` +
                    ` *Obrigado por escolher a gente! 💜*\n`;
            } else if (paymentMethod === 'CASH_ON_DELIVERY') {
                // Adicionar informação de troco se necessário
                const trocoInfo = precisaTroco && valorTroco 
                    ? `\n💰 *Troco para:* R$ ${parseFloat(valorTroco).toFixed(2)}`
                    : '';
                
                message =
                    ` *Pedido Confirmado!* 🎉\n\n` +
                    ` *Pedido Nº:* ${newOrder.id}\n\n` +
                    ` *Itens:*\n${itens}\n\n` +
                    `💰 *Total:* R$ ${Number(newOrder.precoTotal).toFixed(2)}${trocoInfo}\n` +
                    `💵 *Forma de pagamento:* Dinheiro ${tipo === 'pickup' ? 'na Retirada' : 'na Entrega'}\n\n` +
                    `${deliveryInfo}` +
                    notesSection + `\n\n` +
                    ` *Seu pedido já está sendo preparado!*\n` +
                    (tipo === 'pickup' ? `� Tenha o dinheiro trocado em mãos na retirada.` : ` Tenha o dinheiro trocado em mãos na entrega.`) + `\n\n` +
                    ` *Obrigado por escolher a gente! 💜*\n`;
            } else {
                message =
                    ` *Pedido Confirmado!* 🎉\n\n` +
                    ` *Pedido Nº:* ${newOrder.id}\n\n` +
                    ` *Itens:*\n${itens}\n\n` +
                    `💰 *Total:* R$ ${Number(newOrder.precoTotal).toFixed(2)}\n` +
                    `💸 *Forma de pagamento:* PIX\n` +
                    `🔑 *Chave PIX:* 99984959718\n\n` +
                    `${deliveryInfo}` +
                    notesSection + `\n\n` +
                    `📸 *Após o pagamento, por favor envie o comprovante aqui.*\n\n` +
                    ` *Obrigado por escolher a gente! 💜*\n`;
            }

            try {
              await sendWhatsAppMessageZApi(userData.telefone, message);
              console.log('Mensagem enviada para:', userData.telefone);
            } catch (err) {
              console.error('Erro ao enviar mensagem via Z-API:', err.response?.data || err.message);
            }
        }

        // Se o pedido já está em preparo (cartão ou dinheiro), notificar cozinheiro
        if (initialStatus === 'being_prepared') {
            try {
                // Buscar um cozinheiro ativo
                const cozinheiroAtivo = await prisma.cozinheiro.findFirst({
                    where: { ativo: true },
                    orderBy: { criadoEm: 'asc' } // Pega o mais antigo (FIFO)
                });

                if (cozinheiroAtivo) {
                    // Buscar pedido completo com relacionamentos
                    const pedidoCompleto = await prisma.pedido.findUnique({
                        where: { id: newOrder.id },
                        include: {
                            usuario: true,
                            itens_pedido: {
                                include: {
                                    produto: true,
                                    complementos: {
                                        include: {
                                            complemento: true
                                        }
                                    }
                                }
                            }
                        }
                    });

                    console.log(`👨‍🍳 Notificando cozinheiro: ${cozinheiroAtivo.nome}`);
                    await sendCookNotification(pedidoCompleto, cozinheiroAtivo);
                } else {
                    console.log('⚠️ Nenhum cozinheiro ativo encontrado para notificar');
                }
            } catch (err) {
                console.error('❌ Erro ao notificar cozinheiro:', err);
            }
        }

        res.status(201).json({ message: 'Pedido criado com sucesso!', order: newOrder });
    } catch (err) {
        console.error(`[POST /api/orders] Erro ao criar o pedido para o usuário ${userId}:`, err.message);
        res.status(500).json({ message: 'Erro ao criar o pedido.', error: err.message });
    }
});

// Rota para admin criar pedido para um cliente
router.post('/admin', authenticateToken, authorize('admin'), async (req, res) => {
    const { userId, addressId, items, paymentMethod, deliveryType, deliveryFee, notes, precisaTroco, valorTroco } = req.body;
    const adminId = req.user.id;
    
    console.log(`[POST /api/orders/admin] Admin ${adminId} criando pedido para cliente ${userId}`);
    
    if (!userId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Cliente e itens são obrigatórios.' });
    }
    
    if (!paymentMethod) {
        return res.status(400).json({ message: 'Forma de pagamento não informada.' });
    }
    
    const tipo = deliveryType || 'delivery';
    let taxa = deliveryFee || 0;
    
    try {
        // Verificar se o cliente existe e buscar seus endereços
        const user = await prisma.usuario.findUnique({
            where: { id: parseInt(userId) },
            include: { enderecos: true }
        });
        
        if (!user) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }
        
        // Para entrega, verificar endereço
        let shippingAddress = null;
        if (tipo === 'delivery') {
            if (addressId) {
                shippingAddress = user.enderecos.find(addr => addr.id === parseInt(addressId));
                if (!shippingAddress) {
                    return res.status(400).json({ message: 'Endereço selecionado não encontrado.' });
                }
            } else {
                shippingAddress = user.enderecos.find(addr => addr.padrao) || user.enderecos[0];
                if (!shippingAddress) {
                    return res.status(400).json({ message: 'Cliente não possui endereço cadastrado.' });
                }
            }
        }
        
        // Calcular preço total
        let subprecoTotal = 0;
        for (const item of items) {
            const product = await prisma.produto.findUnique({
                where: { id: item.productId }
            });
            
            if (!product) {
                return res.status(400).json({ message: `Produto ID ${item.productId} não encontrado.` });
            }
            
            const itemPrice = item.price || parseFloat(product.preco);
            subprecoTotal += itemPrice * (item.quantity || 1);
        }
        
        // Verificar promoção de frete grátis
        let freteGratis = false;
        if (tipo === 'delivery' && taxa > 0) {
            const storeConfig = await prisma.configuracao_loja.findFirst();
            if (storeConfig && storeConfig.promocaoTaxaAtiva) {
                const hoje = new Date().getDay().toString();
                const diasPromo = storeConfig.promocaoDias ? storeConfig.promocaoDias.split(',') : [];
                
                if (diasPromo.includes(hoje)) {
                    const valorMinimo = parseFloat(storeConfig.promocaoValorMinimo || 0);
                    if (subprecoTotal >= valorMinimo) {
                        taxa = 0;
                        freteGratis = true;
                    }
                }
            }
        }
        
        const precoTotal = subprecoTotal + (tipo === 'delivery' ? taxa : 0);
        const initialStatus = (paymentMethod === 'CREDIT_CARD' || paymentMethod === 'CASH_ON_DELIVERY') ? 'being_prepared' : 'pending_payment';
        
        // Criar pedido
        const newOrder = await prisma.$transaction(async (tx) => {
            const order = await tx.pedido.create({
                data: {
                    usuarioId: parseInt(userId),
                    precoTotal: precoTotal,
                    status: initialStatus,
                    tipoEntrega: tipo,
                    taxaEntrega: tipo === 'delivery' ? taxa : 0,
                    metodoPagamento: paymentMethod,
                    observacoes: notes && notes.trim() ? notes.trim() : null,
                    precisaTroco: paymentMethod === 'CASH_ON_DELIVERY' ? (precisaTroco === true || precisaTroco === 'true') : false,
                    valorTroco: paymentMethod === 'CASH_ON_DELIVERY' && precisaTroco && valorTroco ? parseFloat(valorTroco) : null,
                    atualizadoEm: new Date(),
                    ruaEntrega: shippingAddress?.rua || null,
                    numeroEntrega: shippingAddress?.numero || null,
                    complementoEntrega: shippingAddress?.complemento || null,
                    bairroEntrega: shippingAddress?.bairro || null,
                    telefoneEntrega: user.telefone || null
                }
            });
            
            // Criar itens do pedido
            for (const item of items) {
                const product = await tx.produto.findUnique({
                    where: { id: item.productId }
                });
                
                const itemPrice = item.price || parseFloat(product.preco);
                
                const orderItem = await tx.item_pedido.create({
                    data: {
                        pedidoId: order.id,
                        produtoId: item.productId,
                        quantidade: item.quantity || 1,
                        precoNoPedido: itemPrice
                    }
                });
                
                // Adicionar complementos se fornecidos
                if (item.complementIds && Array.isArray(item.complementIds) && item.complementIds.length > 0) {
                    await Promise.all(
                        item.complementIds.map(complementId =>
                            tx.item_pedido_complemento.create({
                                data: {
                                    itemPedidoId: orderItem.id,
                                    complementoId: complementId
                                }
                            })
                        )
                    );
                }
            }
            
            // Criar pagamento
            await tx.pagamento.create({
                data: {
                    pedidoId: order.id,
                    valor: precoTotal,
                    metodo: paymentMethod,
                    status: paymentMethod === 'PIX' ? 'PENDING' : (paymentMethod === 'CREDIT_CARD' || paymentMethod === 'CASH_ON_DELIVERY' ? 'PAID' : 'PENDING'),
                    atualizadoEm: new Date()
                }
            });
            
            return await tx.pedido.findUnique({
                where: { id: order.id },
                include: {
                    itens_pedido: {
                        include: {
                            produto: true
                        }
                    },
                    usuario: {
                        select: {
                            id: true,
                            nomeUsuario: true,
                            telefone: true
                        }
                    }
                }
            });
        });
        
        console.log(`[POST /api/orders/admin] Pedido ID ${newOrder.id} criado com sucesso pelo admin ${adminId} para cliente ${userId}`);
        
        // Enviar mensagem de confirmação para o cliente
        if (user.telefone) {
            try {
                // Buscar pedido completo com itens e complementos para a mensagem
                const orderWithItems = await prisma.pedido.findUnique({
                    where: { id: newOrder.id },
                    include: {
                        itens_pedido: {
                            include: {
                                produto: true,
                                complementos: {
                                    include: {
                                        complemento: true
                                    }
                                }
                            }
                        },
                        usuario: {
                            select: {
                                nomeUsuario: true,
                                telefone: true
                            }
                        }
                    }
                });
                
                const itens = orderWithItems.itens_pedido.map(item => {
                    const complementos = item.complementos?.map(ic => ic.complemento?.nome).filter(Boolean).join(', ');
                    return `• ${item.quantidade}x ${item.produto.nome}${complementos ? ` (${complementos})` : ''}`;
                }).join('\n');
                
                // Informações de entrega/retirada
                const deliveryInfo = tipo === 'pickup' 
                    ? `📍 *Retirada no local*\n🏪 Endereço da loja: Açaidicasa, praça Geraldo Sá.\n` +
                    `Localização maps: https://maps.app.goo.gl/LGe84k24KogZWXMt6?g_st=ipc`
                    : `*Entrega em casa*\n📍 Endereço: ${shippingAddress.rua}, ${shippingAddress.numero}${shippingAddress.complemento ? ` - ${shippingAddress.complemento}` : ''}\nBairro: ${shippingAddress.bairro}${shippingAddress.pontoReferencia ? `\n*Referência:* ${shippingAddress.pontoReferencia}` : ''}`;
                
                // Adicionar observações se houver
                const notesSection = notes && notes.trim() ? `\n\n📝 *Observações:*\n${notes.trim()}` : '';
                
                let message;
                
                if (paymentMethod === 'CREDIT_CARD') {
                    message =
                        `*Pedido Confirmado!* 🎉\n\n` +
                        `*Pedido Nº:* ${newOrder.id}\n\n` +
                        `*Itens:*\n${itens}\n\n` +
                        `💰 *Total:* R$ ${Number(newOrder.precoTotal).toFixed(2)}\n` +
                        `💳 *Forma de pagamento:* Cartão de Crédito\n\n` +
                        `${deliveryInfo}` +
                        notesSection + `\n\n` +
                        `*Seu pedido já está sendo preparado!*\n` +
                        (tipo === 'pickup' ? `Você pode retirar em breve!` : `Em breve será enviado para entrega.`) + `\n\n` +
                        `*Obrigado por escolher a gente! 💜*\n`;
                } else if (paymentMethod === 'CASH_ON_DELIVERY') {
                    // Adicionar informação de troco se necessário
                    const trocoInfo = precisaTroco && valorTroco 
                        ? `\n💰 *Troco para:* R$ ${parseFloat(valorTroco).toFixed(2)}`
                        : '';
                    
                    message =
                        `*Pedido Confirmado!* 🎉\n\n` +
                        `*Pedido Nº:* ${newOrder.id}\n\n` +
                        `*Itens:*\n${itens}\n\n` +
                        `💰 *Total:* R$ ${Number(newOrder.precoTotal).toFixed(2)}${trocoInfo}\n` +
                        `💵 *Forma de pagamento:* Dinheiro ${tipo === 'pickup' ? 'na Retirada' : 'na Entrega'}\n\n` +
                        `${deliveryInfo}` +
                        notesSection + `\n\n` +
                        `*Seu pedido já está sendo preparado!*\n` +
                        (tipo === 'pickup' ? `Tenha o dinheiro trocado em mãos na retirada.` : `Tenha o dinheiro trocado em mãos na entrega.`) + `\n\n` +
                        `*Obrigado por escolher a gente! 💜*\n`;
                } else {
                    message =
                        `*Pedido Confirmado!* 🎉\n\n` +
                        `*Pedido Nº:* ${newOrder.id}\n\n` +
                        `*Itens:*\n${itens}\n\n` +
                        `💰 *Total:* R$ ${Number(newOrder.precoTotal).toFixed(2)}\n` +
                        `💸 *Forma de pagamento:* PIX\n` +
                        `🔑 *Chave PIX:* 99984959718\n\n` +
                        `${deliveryInfo}` +
                        notesSection + `\n\n` +
                        `📸 *Após o pagamento, por favor envie o comprovante aqui.*\n\n` +
                        `*Obrigado por escolher a gente! 💜*\n`;
                }
                
                await sendWhatsAppMessageZApi(user.telefone, message);
                console.log(`[POST /api/orders/admin] Mensagem de confirmação enviada para o cliente ${userId} no telefone ${user.telefone}`);
            } catch (err) {
                console.error(`[POST /api/orders/admin] Erro ao enviar mensagem de confirmação para o cliente:`, err.response?.data || err.message);
                // Não falha a operação se a mensagem falhar
            }
        } else {
            console.log(`[POST /api/orders/admin] Cliente ${userId} não possui telefone cadastrado para envio de confirmação`);
        }
        
        // Se o pedido já está em preparo (cartão ou dinheiro), notificar cozinheiro
        if (initialStatus === 'being_prepared') {
            try {
                // Buscar um cozinheiro ativo
                const cozinheiroAtivo = await prisma.cozinheiro.findFirst({
                    where: { ativo: true },
                    orderBy: { criadoEm: 'asc' } // Pega o mais antigo (FIFO)
                });

                if (cozinheiroAtivo) {
                    // Buscar pedido completo com relacionamentos
                    const pedidoCompleto = await prisma.pedido.findUnique({
                        where: { id: newOrder.id },
                        include: {
                            usuario: true,
                            itens_pedido: {
                                include: {
                                    produto: true,
                                    complementos: {
                                        include: {
                                            complemento: true
                                        }
                                    }
                                }
                            }
                        }
                    });

                    console.log(`👨‍🍳 Notificando cozinheiro: ${cozinheiroAtivo.nome}`);
                    await sendCookNotification(pedidoCompleto, cozinheiroAtivo);
                } else {
                    console.log('⚠️ Nenhum cozinheiro ativo encontrado para notificar');
                }
            } catch (err) {
                console.error('❌ Erro ao notificar cozinheiro:', err);
            }
        }
        
        res.status(201).json({ message: 'Pedido criado com sucesso!', order: newOrder });
    } catch (err) {
        console.error(`[POST /api/orders/admin] Erro ao criar pedido:`, err);
        res.status(500).json({ message: 'Erro ao criar pedido.', error: err.message });
    }
});

// Rota para ver o histórico de pedidos do usuário
router.get('/history', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    console.log(`[GET /api/orders/history] Recebida requisição para o histórico de pedidos. Usuário ID: ${userId}`);
    
    try {
        const orders = await prisma.pedido.findMany({
            where: { usuarioId: userId },
            include: {
                itens_pedido: {
                    include: {
                        produto: {
                            include: {
                                imagens_produto: true
                            }
                        },
                        complementos: {
                            include: {
                                complemento: true
                            }
                        }
                    }
                },
                pagamento: true
            },
            orderBy: {
                criadoEm: 'desc'
            }
        });

        // Transformar os dados para o formato esperado pelo frontend
        const transformedOrders = orders.map(order => ({
            id: order.id,
            userId: order.usuarioId,
            totalPrice: order.precoTotal,
            status: order.status,
            deliveryType: order.tipoEntrega,
            createdAt: order.criadoEm,
            shippingStreet: order.ruaEntrega,
            shippingNumber: order.numeroEntrega,
            shippingComplement: order.complementoEntrega,
            shippingNeighborhood: order.bairroEntrega,
            shippingPhone: order.telefoneEntrega,
            deliveryFee: order.taxaEntrega,
            notes: order.observacoes,
            precisaTroco: order.precisaTroco || false,
            valorTroco: order.valorTroco ? Number(order.valorTroco) : null,
            orderitem: order.itens_pedido.map(item => ({
                id: item.id,
                orderId: item.pedidoId,
                productId: item.produtoId,
                quantity: item.quantidade,
                priceAtOrder: item.precoNoPedido,
                selectedOptionsSnapshot: item.opcoesSelecionadasSnapshot,
                complements: item.complementos ? item.complementos.map(c => ({
                    id: c.complemento.id,
                    name: c.complemento.nome,
                    imageUrl: c.complemento.imagemUrl,
                    isActive: c.complemento.ativo
                })) : [],
                product: {
                    id: item.produto.id,
                    name: item.produto.nome,
                    price: item.produto.preco,
                    description: item.produto.descricao,
                    isActive: item.produto.ativo,
                    createdAt: item.produto.criadoEm,
                    categoryId: item.produto.categoriaId,
                    images: item.produto.imagens_produto?.map(img => ({
                        id: img.id,
                        url: img.urlImagem,
                        altText: img.textoAlternativo,
                        productId: img.produtoId
                    })) || []
                }
            })),
            payment: order.pagamento ? {
                id: order.pagamento.id,
                amount: order.pagamento.valor,
                method: order.pagamento.metodo,
                status: order.pagamento.status,
                transactionId: order.pagamento.idTransacao,
                createdAt: order.pagamento.criadoEm,
                updatedAt: order.pagamento.atualizadoEm,
                orderId: order.pagamento.pedidoId
            } : null
        }));

        console.log(`[GET /api/orders/history] Histórico de pedidos do usuário ${userId} buscado com sucesso. Total de pedidos: ${transformedOrders.length}`);
        res.status(200).json(transformedOrders);
    } catch (err) {
        console.error(`[GET /api/orders/history] Erro ao buscar o histórico de pedidos para o usuário ${userId}:`, err.message);
        res.status(500).json({ message: 'Erro ao buscar o histórico de pedidos.', error: err.message });
    }
});

// Rota para atualizar o status de um pedido (apenas para administradores)
router.put('/status/:orderId', authenticateToken, authorize('admin'), async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const { status, delivererId } = req.body;
    console.log(`[PUT /api/orders/status/${orderId}] Recebida requisição de admin para atualizar status para: "${status}"`);

    // Adicione uma validação para garantir que o status é válido
    const validStatuses = ['pending_payment', 'being_prepared', 'ready_for_pickup', 'on_the_way', 'delivered', 'canceled'];
    if (!validStatuses.includes(status)) {
        console.warn(`[PUT /api/orders/status/${orderId}] Tentativa de usar status inválido: "${status}".`);
        return res.status(400).json({ message: 'Status inválido. Por favor, use um dos seguintes: ' + validStatuses.join(', ') });
    }

    try {
        // Buscar o pedido atual primeiro para comparar o status
        const currentOrder = await prisma.pedido.findUnique({
            where: { id: orderId },
            include: {
                pagamento: {
                    select: {
                        metodo: true
                    }
                }
            }
        });

        if (!currentOrder) {
            console.error(`[PUT /api/orders/status/${orderId}] Erro: Pedido não encontrado.`);
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        // Verificar se o entregador existe e está ativo (se fornecido)
        if (delivererId) {
            const deliverer = await prisma.entregador.findUnique({
                where: { id: parseInt(delivererId) }
            });
            
            if (!deliverer || !deliverer.ativo) {
                console.warn(`[PUT /api/orders/status/${orderId}] Entregador não encontrado ou inativo. ID: ${delivererId}`);
                return res.status(400).json({ message: 'Entregador não encontrado ou inativo' });
            }
        }

        const updatedOrder = await prisma.pedido.update({
            where: { id: orderId },
            data: { 
                status: status,
                entregadorId: delivererId ? parseInt(delivererId) : undefined,
                atualizadoEm: new Date()
            },
            include: {
                itens_pedido: {
                    include: {
                        produto: true,
                        complementos: {
                            include: {
                                complemento: true
                            }
                        }
                    }
                },
                usuario: {
                    select: {
                        id: true,
                        nomeUsuario: true,
                        email: true,
                        telefone: true
                    }
                },
                entregador: {
                    select: {
                        id: true,
                        nome: true,
                        telefone: true
                    }
                },
                pagamento: {
                    select: {
                        metodo: true
                    }
                }
            }
        });

        // Enviar notificação de pagamento confirmado se mudou de "pending_payment" para "being_prepared" (PIX)
        if (currentOrder.status === 'pending_payment' && status === 'being_prepared') {
            try {
                console.log('💳 Enviando notificação de pagamento confirmado...');
                // Buscar referência do endereço usado no pedido (não o padrão)
                // O endereço já está salvo no pedido, buscar a referência correspondente
                let referenciaEntrega = null;
                if (updatedOrder.ruaEntrega && updatedOrder.numeroEntrega) {
                    const enderecoUsado = await prisma.endereco.findFirst({
                        where: {
                            usuarioId: updatedOrder.usuarioId,
                            rua: updatedOrder.ruaEntrega,
                            numero: updatedOrder.numeroEntrega,
                            bairro: updatedOrder.bairroEntrega
                    }
                });
                    referenciaEntrega = enderecoUsado?.pontoReferencia || null;
                }
                const orderWithReference = {
                    ...updatedOrder,
                    referenciaEntrega: referenciaEntrega
                };
                await sendPaymentConfirmationNotification(orderWithReference);
                
                // Notificar cozinheiro quando pedido entra em preparo
                const cozinheiroAtivo = await prisma.cozinheiro.findFirst({
                    where: { ativo: true },
                    orderBy: { criadoEm: 'asc' }
                });

                if (cozinheiroAtivo) {
                    console.log(`👨‍🍳 Notificando cozinheiro: ${cozinheiroAtivo.nome}`);
                    await sendCookNotification(updatedOrder, cozinheiroAtivo);
                } else {
                    console.log('⚠️ Nenhum cozinheiro ativo encontrado para notificar');
                }
            } catch (error) {
                console.error('❌ Erro ao enviar notificação de pagamento confirmado:', error);
                // Não falha a operação se as notificações falharem
            }
        }

        // Enviar notificações se o status mudou para "on_the_way" e há um entregador
        if (status === 'on_the_way' && updatedOrder.entregador) {
            try {
                console.log('📱 Enviando notificações de entrega...');
                // Buscar referência do endereço usado no pedido (não o padrão)
                let referenciaEntrega = null;
                if (updatedOrder.ruaEntrega && updatedOrder.numeroEntrega) {
                    const enderecoUsado = await prisma.endereco.findFirst({
                        where: {
                            usuarioId: updatedOrder.usuarioId,
                            rua: updatedOrder.ruaEntrega,
                            numero: updatedOrder.numeroEntrega,
                            bairro: updatedOrder.bairroEntrega
                    }
                });
                    referenciaEntrega = enderecoUsado?.pontoReferencia || null;
                }
                
                // Mapear campos para compatibilidade com messageService
                const orderForNotification = {
                    ...updatedOrder,
                    totalPrice: updatedOrder.precoTotal,
                    user: updatedOrder.usuario ? {
                        username: updatedOrder.usuario.nomeUsuario,
                        phone: updatedOrder.usuario.telefone
                    } : null,
                    orderItems: updatedOrder.itens_pedido.map(item => ({
                        ...item,
                        product: item.produto // garantir campo 'product' (inglês)
                    })),
                    shippingStreet: updatedOrder.ruaEntrega,
                    shippingNumber: updatedOrder.numeroEntrega,
                    shippingComplement: updatedOrder.complementoEntrega,
                    shippingNeighborhood: updatedOrder.bairroEntrega,
                    shippingReference: referenciaEntrega,
                    shippingPhone: updatedOrder.usuario?.telefone
                };
                await sendDeliveryNotifications(orderForNotification, updatedOrder.entregador);
            } catch (error) {
                console.error('❌ Erro ao enviar notificações:', error);
                // Não falha a operação se as notificações falharem
            }
        }

        // Enviar notificação de cancelamento se o status mudou para "canceled"
        if (status === 'canceled' && currentOrder.status !== 'canceled') {
            try {
                console.log('❌ Enviando notificação de cancelamento ao cliente...');
                await sendOrderCancellationNotification(updatedOrder);
            } catch (error) {
                console.error('❌ Erro ao enviar notificação de cancelamento:', error);
                // Não falha a operação se a notificação falhar
            }
        }

        console.log(`[PUT /api/orders/status/${orderId}] Status do pedido atualizado com sucesso para "${updatedOrder.status}".`);
        res.status(200).json({ message: 'Status do pedido atualizado com sucesso!', order: updatedOrder });
    } catch (err) {
        if (err.code === 'P2025') { // Erro de registro não encontrado
            console.error(`[PUT /api/orders/status/${orderId}] Erro: Pedido não encontrado.`);
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }
        console.error(`[PUT /api/orders/status/${orderId}] Erro ao atualizar o status do pedido:`, err.message);
        res.status(500).json({ message: 'Erro ao atualizar o status do pedido.', error: err.message });
    }
});

// Rota para atualizar o valor total do pedido (apenas admin) - DEVE VIR ANTES DA ROTA GENÉRICA
router.put('/:orderId/update-total', authenticateToken, authorize('admin'), async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const { totalPrice } = req.body;
    console.log(`[PUT /api/orders/${orderId}/update-total] Atualizando valor total do pedido para: R$ ${totalPrice}`);

    try {
        if (!totalPrice || totalPrice <= 0) {
            return res.status(400).json({ message: 'Valor total inválido' });
        }

        const order = await prisma.pedido.findUnique({
            where: { id: orderId },
            include: {
                itens_pedido: {
                    include: {
                        produto: true,
                        complementos: {
                            include: {
                                complemento: true
                            }
                        }
                    }
                },
                usuario: {
                    select: {
                        id: true,
                        nomeUsuario: true,
                        email: true,
                        telefone: true
                    }
                }
            }
        });

        if (!order) {
            return res.status(404).json({ message: 'Pedido não encontrado' });
        }

        // Capturar valor antigo antes de atualizar
        const oldTotal = parseFloat(order.precoTotal);
        const newTotal = parseFloat(totalPrice);

        // Atualizar valor do pedido e pagamento
        const updatedOrder = await prisma.$transaction(async (tx) => {
            // Atualizar pedido
            const updated = await tx.pedido.update({
                where: { id: orderId },
                data: {
                    precoTotal: newTotal,
                    atualizadoEm: new Date()
                },
                include: {
                    itens_pedido: {
                        include: {
                            produto: true,
                            complementos: {
                                include: {
                                    complemento: true
                                }
                            }
                        }
                    },
                    usuario: {
                        select: {
                            id: true,
                            nomeUsuario: true,
                            email: true,
                            telefone: true
                        }
                    },
                    pagamento: true
                }
            });

            // Atualizar pagamento se existir
            if (updated.pagamento) {
                await tx.pagamento.update({
                    where: { pedidoId: orderId },
                    data: {
                        valor: newTotal,
                        atualizadoEm: new Date()
                    }
                });
            }

            return updated;
        });

        // Enviar notificação ao cliente se o valor foi alterado
        if (oldTotal !== newTotal) {
            try {
                console.log(`📱 [PUT /api/orders/${orderId}/update-total] Enviando notificação de edição ao cliente...`);
                const editReason = `O valor do pedido foi ajustado de R$ ${oldTotal.toFixed(2)} para R$ ${newTotal.toFixed(2)}.`;
                await sendOrderEditNotification(updatedOrder, oldTotal, newTotal, editReason);
            } catch (error) {
                console.error('❌ Erro ao enviar notificação de edição:', error);
                // Não falha a operação se a notificação falhar
            }
        }

        console.log(`[PUT /api/orders/${orderId}/update-total] Valor atualizado com sucesso`);
        res.status(200).json({ message: 'Valor do pedido atualizado com sucesso!', data: updatedOrder });
    } catch (error) {
        console.error(`[PUT /api/orders/${orderId}/update-total] Erro:`, error.message);
        res.status(500).json({ message: 'Erro ao atualizar valor do pedido', error: error.message });
    }
});

// Rota para adicionar item ao pedido (apenas admin) - DEVE VIR ANTES DA ROTA GENÉRICA
router.post('/:orderId/add-item', authenticateToken, authorize('admin'), async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const { productId, quantity, complementIds, price } = req.body;
    console.log(`[POST /api/orders/${orderId}/add-item] Adicionando item ao pedido`);

    try {
        if (!productId || !quantity || quantity <= 0) {
            return res.status(400).json({ message: 'Dados inválidos' });
        }

        const order = await prisma.pedido.findUnique({
            where: { id: orderId },
            include: { itens_pedido: true }
        });

        if (!order) {
            return res.status(404).json({ message: 'Pedido não encontrado' });
        }

        // Verificar se o produto existe
        const product = await prisma.produto.findUnique({
            where: { id: productId }
        });

        if (!product) {
            return res.status(404).json({ message: 'Produto não encontrado' });
        }

        // Usar preço fornecido ou preço do produto
        const itemPrice = price ? parseFloat(price) : parseFloat(product.preco);
        
        // Capturar valor antigo antes de atualizar
        const oldTotal = parseFloat(order.precoTotal);

        const updatedOrder = await prisma.$transaction(async (tx) => {
            // Adicionar item ao pedido
            const newItem = await tx.item_pedido.create({
                data: {
                    pedidoId: orderId,
                    produtoId: productId,
                    quantidade: parseInt(quantity),
                    precoNoPedido: itemPrice
                }
            });

            // Adicionar complementos se fornecidos
            if (complementIds && Array.isArray(complementIds) && complementIds.length > 0) {
                await Promise.all(
                    complementIds.map(complementId =>
                        tx.item_pedido_complemento.create({
                            data: {
                                itemPedidoId: newItem.id,
                                complementoId: complementId
                            }
                        })
                    )
                );
            }

            // Somar o valor do novo item ao valor atual do pedido (que pode ter sido editado manualmente)
            const itemValue = itemPrice * parseInt(quantity);
            const currentTotal = parseFloat(order.precoTotal);
            const newTotal = currentTotal + itemValue;

            // Atualizar pedido
            const updated = await tx.pedido.update({
                where: { id: orderId },
                data: {
                    precoTotal: newTotal,
                    atualizadoEm: new Date()
                },
                include: {
                    itens_pedido: {
                        include: {
                            produto: true,
                            complementos: {
                                include: {
                                    complemento: true
                                }
                            }
                        }
                    },
                    usuario: {
                        select: {
                            id: true,
                            nomeUsuario: true,
                            email: true,
                            telefone: true
                        }
                    },
                    pagamento: true
                }
            });

            // Atualizar pagamento se existir
            if (updated.pagamento) {
                await tx.pagamento.update({
                    where: { pedidoId: orderId },
                    data: {
                        valor: newTotal,
                        atualizadoEm: new Date()
                    }
                });
            }

            return updated;
        });

        // Enviar notificação ao cliente se o valor foi alterado
        const newTotal = parseFloat(updatedOrder.precoTotal);
        if (oldTotal !== newTotal) {
            try {
                console.log(`📱 [POST /api/orders/${orderId}/add-item] Enviando notificação de edição ao cliente...`);
                const editReason = `Um item foi adicionado ao seu pedido. O valor foi ajustado de R$ ${oldTotal.toFixed(2)} para R$ ${newTotal.toFixed(2)}.`;
                await sendOrderEditNotification(updatedOrder, oldTotal, newTotal, editReason);
            } catch (error) {
                console.error('❌ Erro ao enviar notificação de edição:', error);
                // Não falha a operação se a notificação falhar
            }
        }

        console.log(`[POST /api/orders/${orderId}/add-item] Item adicionado com sucesso`);
        res.status(200).json({ message: 'Item adicionado ao pedido com sucesso!', data: updatedOrder });
    } catch (error) {
        console.error(`[POST /api/orders/${orderId}/add-item] Erro:`, error.message);
        res.status(500).json({ message: 'Erro ao adicionar item ao pedido', error: error.message });
    }
});

// Rota para remover item do pedido (apenas admin) - DEVE VIR ANTES DA ROTA GENÉRICA
router.delete('/:orderId/remove-item/:itemId', authenticateToken, authorize('admin'), async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const itemId = parseInt(req.params.itemId);
    console.log(`[DELETE /api/orders/${orderId}/remove-item/${itemId}] Removendo item do pedido`);

    try {
        const order = await prisma.pedido.findUnique({
            where: { id: orderId },
            include: { itens_pedido: true }
        });

        if (!order) {
            return res.status(404).json({ message: 'Pedido não encontrado' });
        }

        const item = order.itens_pedido.find(i => i.id === itemId);
        if (!item) {
            return res.status(404).json({ message: 'Item não encontrado no pedido' });
        }

        // Capturar valor antigo antes de atualizar
        const oldTotal = parseFloat(order.precoTotal);

        const updatedOrder = await prisma.$transaction(async (tx) => {
            // Remover complementos do item primeiro
            await tx.item_pedido_complemento.deleteMany({
                where: { itemPedidoId: itemId }
            });

            // Calcular o valor do item que será removido antes de removê-lo
            const itemValue = parseFloat(item.precoNoPedido) * item.quantidade;
            
            // Remover item
            await tx.item_pedido.delete({
                where: { id: itemId }
            });

            // Subtrair o valor do item removido do total atual do pedido (que pode ter sido editado manualmente)
            const currentTotal = parseFloat(order.precoTotal);
            const newTotal = currentTotal - itemValue;

            // Atualizar pedido
            const updated = await tx.pedido.update({
                where: { id: orderId },
                data: {
                    precoTotal: newTotal,
                    atualizadoEm: new Date()
                },
                include: {
                    itens_pedido: {
                        include: {
                            produto: true,
                            complementos: {
                                include: {
                                    complemento: true
                                }
                            }
                        }
                    },
                    usuario: {
                        select: {
                            id: true,
                            nomeUsuario: true,
                            email: true,
                            telefone: true
                        }
                    },
                    pagamento: true
                }
            });

            // Atualizar pagamento se existir
            if (updated.pagamento) {
                await tx.pagamento.update({
                    where: { pedidoId: orderId },
                    data: {
                        valor: newTotal,
                        atualizadoEm: new Date()
                    }
                });
            }

            return updated;
        });

        // Enviar notificação ao cliente se o valor foi alterado
        const newTotal = parseFloat(updatedOrder.precoTotal);
        if (oldTotal !== newTotal) {
            try {
                console.log(`📱 [DELETE /api/orders/${orderId}/remove-item/${itemId}] Enviando notificação de edição ao cliente...`);
                const editReason = `Um item foi removido do seu pedido. O valor foi ajustado de R$ ${oldTotal.toFixed(2)} para R$ ${newTotal.toFixed(2)}.`;
                await sendOrderEditNotification(updatedOrder, oldTotal, newTotal, editReason);
            } catch (error) {
                console.error('❌ Erro ao enviar notificação de edição:', error);
                // Não falha a operação se a notificação falhar
            }
        }

        console.log(`[DELETE /api/orders/${orderId}/remove-item/${itemId}] Item removido com sucesso`);
        res.status(200).json({ message: 'Item removido do pedido com sucesso!', data: updatedOrder });
    } catch (error) {
        console.error(`[DELETE /api/orders/${orderId}/remove-item/${itemId}] Erro:`, error.message);
        res.status(500).json({ message: 'Erro ao remover item do pedido', error: error.message });
    }
});

// Nova rota PUT para compatibilidade com o frontend (/orders/:orderId)
router.put('/:orderId', authenticateToken, authorize('admin'), async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const { status, delivererId } = req.body;
    console.log(`[PUT /api/orders/${orderId}] Recebida requisição de admin para atualizar pedido. Status: "${status}", Entregador: ${delivererId}`);

    try {
        // Verificar se o pedido existe
        const existingOrder = await prisma.pedido.findUnique({
            where: { id: orderId }
        });

        if (!existingOrder) {
            console.error(`[PUT /api/orders/${orderId}] Erro: Pedido não encontrado.`);
            return res.status(404).json({ message: 'Pedido não encontrado' });
        }

        // Mapear status do frontend para formato do banco
        const statusMapping = {
            'pending_payment': 'pending_payment',
            'being_prepared': 'being_prepared', 
            'on_the_way': 'on_the_way',
            'delivered': 'delivered',
            'canceled': 'canceled'
        };

        let dbStatus = status;
        if (status && statusMapping[status]) {
            dbStatus = statusMapping[status];
            console.log(`[PUT /api/orders/${orderId}] Status validado: "${status}" -> "${dbStatus}"`);
        }

        // Validar status se fornecido
        const validStatuses = ['pending_payment', 'being_prepared', 'ready_for_pickup', 'on_the_way', 'delivered', 'canceled'];
        if (dbStatus && !validStatuses.includes(dbStatus)) {
            console.warn(`[PUT /api/orders/${orderId}] Status inválido: "${dbStatus}".`);
            return res.status(400).json({ message: 'Status inválido' });
        }

        // Validar entregador se fornecido
        if (delivererId) {
            const deliverer = await prisma.entregador.findUnique({
                where: { id: parseInt(delivererId) }
            });
            
            if (!deliverer || !deliverer.ativo) {
                console.warn(`[PUT /api/orders/${orderId}] Entregador não encontrado ou inativo. ID: ${delivererId}`);
                return res.status(400).json({ message: 'Entregador não encontrado ou inativo' });
            }
        }

        // Validação: NENHUM pedido pode ser cancelado se estiver a caminho, pronto para retirada ou entregue
        if (dbStatus === 'canceled' && (existingOrder.status === 'on_the_way' || existingOrder.status === 'ready_for_pickup' || existingOrder.status === 'delivered')) {
            console.warn(`[PUT /api/orders/${orderId}] Não é possível cancelar. Status atual: "${existingOrder.status}".`);
            return res.status(400).json({ message: `Não é possível cancelar um pedido com o status "${existingOrder.status}".` });
        }

        // Atualizar pedido
        const order = await prisma.pedido.update({
            where: { id: orderId },
            data: {
                status: dbStatus || existingOrder.status,
                entregadorId: delivererId !== undefined ? (delivererId ? parseInt(delivererId) : null) : existingOrder.entregadorId,
                atualizadoEm: new Date()
            },
            include: {
                itens_pedido: {
                    include: {
                        produto: true,
                        complementos: {
                            include: {
                                complemento: true
                            }
                        }
                    }
                },
                usuario: {
                    select: {
                        id: true,
                        nomeUsuario: true,
                        email: true,
                        telefone: true
                    }
                },
                entregador: {
                    select: {
                        id: true,
                        nome: true,
                        telefone: true
                    }
                },
                pagamento: {
                    select: {
                        metodo: true
                    }
                }
            }
        });

        // Enviar notificação de pagamento confirmado se mudou de "pending_payment" para "being_prepared" (PIX)
        if (existingOrder.status === 'pending_payment' && dbStatus === 'being_prepared') {
            try {
                console.log('💳 Enviando notificação de pagamento confirmado...');
                // Buscar referência do endereço usado no pedido (não o padrão)
                let referenciaEntrega = null;
                if (order.ruaEntrega && order.numeroEntrega) {
                    const enderecoUsado = await prisma.endereco.findFirst({
                        where: {
                            usuarioId: order.usuarioId,
                            rua: order.ruaEntrega,
                            numero: order.numeroEntrega,
                            bairro: order.bairroEntrega
                    }
                });
                    referenciaEntrega = enderecoUsado?.pontoReferencia || null;
                }
                const orderWithReference = {
                    ...order,
                    referenciaEntrega: referenciaEntrega
                };
                await sendPaymentConfirmationNotification(orderWithReference);
                // Notificar cozinheiro quando pedido entra em preparo
                const cozinheiroAtivo = await prisma.cozinheiro.findFirst({
                    where: { ativo: true },
                    orderBy: { criadoEm: 'asc' }
                });
                if (cozinheiroAtivo) {
                    console.log(`👨‍🍳 Notificando cozinheiro: ${cozinheiroAtivo.nome}`);
                    await sendCookNotification(order, cozinheiroAtivo);
                } else {
                    console.log('⚠️ Nenhum cozinheiro ativo encontrado para notificar');
                }
            } catch (error) {
                console.error('❌ Erro ao enviar notificação de pagamento confirmado:', error);
                // Não falha a operação se as notificações falharem
            }
        }

        // Enviar confirmação de entrega ao cliente se status for 'delivered'
        if (dbStatus === 'delivered') {
            try {
                console.log('📦 Enviando confirmação de entrega ao cliente...');
                await sendDeliveredConfirmationNotification(order);
            } catch (error) {
                console.error('❌ Erro ao enviar confirmação de entrega:', error);
            }
        }

        // Enviar notificação de cancelamento se o status mudou para "canceled"
        if (dbStatus === 'canceled' && existingOrder.status !== 'canceled') {
            try {
                console.log('❌ Enviando notificação de cancelamento ao cliente...');
                // Buscar dados completos do pedido com itens e complementos
                const orderWithItems = await prisma.pedido.findUnique({
                    where: { id: orderId },
                    include: {
                        itens_pedido: {
                            include: {
                                produto: true,
                                complementos: {
                                    include: {
                                        complemento: true
                                    }
                                }
                            }
                        },
                        usuario: {
                            select: {
                                id: true,
                                nomeUsuario: true,
                                email: true,
                                telefone: true
                            }
                        },
                        pagamento: {
                            select: {
                                metodo: true
                            }
                        }
                    }
                });
                await sendOrderCancellationNotification(orderWithItems);
            } catch (error) {
                console.error('❌ Erro ao enviar notificação de cancelamento:', error);
                // Não falha a operação se a notificação falhar
            }
        }

        // Enviar notificações baseadas no tipo de pedido e status
        if (dbStatus === 'on_the_way' && order.entregador && order.tipoEntrega === 'delivery') {
            // Notificação para entrega com entregador
            try {
                console.log('📱 Enviando notificações de entrega...');
                // Buscar referência do endereço usado no pedido (não o padrão)
                let referenciaEntrega = null;
                if (order.ruaEntrega && order.numeroEntrega) {
                    const enderecoUsado = await prisma.endereco.findFirst({
                        where: {
                            usuarioId: order.usuarioId,
                            rua: order.ruaEntrega,
                            numero: order.numeroEntrega,
                            bairro: order.bairroEntrega
                    }
                });
                    referenciaEntrega = enderecoUsado?.pontoReferencia || null;
                }
                
                // Mapear campos para compatibilidade com messageService
                const orderForNotification = {
                    ...order,
                    totalPrice: order.precoTotal,
                    user: order.usuario ? {
                        username: order.usuario.nomeUsuario,
                        phone: order.usuario.telefone
                    } : null,
                    orderItems: order.itens_pedido.map(item => ({
                        ...item,
                        product: item.produto // garantir campo 'product' (inglês)
                    })),
                    shippingStreet: order.ruaEntrega,
                    shippingNumber: order.numeroEntrega,
                    shippingComplement: order.complementoEntrega,
                    shippingNeighborhood: order.bairroEntrega,
                    shippingReference: referenciaEntrega,
                    shippingPhone: order.usuario?.telefone
                };
                await sendDeliveryNotifications(orderForNotification, order.entregador);
            } catch (error) {
                console.error('❌ Erro ao enviar notificações de entrega:', error);
            }
        } else if (dbStatus === 'ready_for_pickup' && order.tipoEntrega === 'pickup') {
                        // Notificação para retirada
                        try {
                                console.log('🏪 Enviando notificação de retirada...');
                                // Mapear campos para compatibilidade com messageService
                                const orderForNotification = {
                                    ...order,
                                    totalPrice: order.precoTotal,
                                    deliveryType: order.tipoEntrega,
                                    paymentMethod: order.metodoPagamento,
                                    user: order.usuario ? {
                                        username: order.usuario.nomeUsuario,
                                        phone: order.usuario.telefone
                                    } : null,
                                    orderItems: order.itens_pedido,
                                    shippingStreet: order.ruaEntrega,
                                    shippingNumber: order.numeroEntrega,
                                    shippingComplement: order.complementoEntrega,
                                    shippingNeighborhood: order.bairroEntrega,
                                    shippingPhone: order.usuario?.telefone
                                };
                                await sendPickupNotification(orderForNotification);
                        } catch (error) {
                                console.error('❌ Erro ao enviar notificação de retirada:', error);
                        }
        }

        console.log(`[PUT /api/orders/${orderId}] Pedido atualizado com sucesso.`);
        res.json(order);
    } catch (error) {
        console.error(`[PUT /api/orders/${orderId}] Erro ao atualizar pedido:`, error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

// Rota para cancelar um pedido
router.put('/cancel/:orderId', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.funcao; // Corrigido: usar 'funcao' em vez de 'role'
    const orderId = parseInt(req.params.orderId);
    console.log(`[PUT /api/orders/cancel/${orderId}] Recebida requisição para cancelar pedido. Usuário ID: ${userId}, Função: ${userRole}`);

    try {
        const order = await prisma.pedido.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            console.warn(`[PUT /api/orders/cancel/${orderId}] Pedido não encontrado.`);
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        // Verifica se o usuário é o dono do pedido ou um administrador
        if (order.usuarioId !== userId && userRole !== 'admin' && userRole !== 'master') {
            console.warn(`[PUT /api/orders/cancel/${orderId}] Acesso negado. Usuário ID ${userId} (${userRole}) tentou cancelar pedido que não lhe pertence (pedido do usuário ${order.usuarioId}).`);
            return res.status(403).json({ message: 'Acesso negado: você não tem permissão para cancelar este pedido.' });
        }
        
        // Se o pedido já está cancelado, não há nada a fazer
        if (order.status === 'canceled') {
            console.warn(`[PUT /api/orders/cancel/${orderId}] Pedido já está cancelado.`);
            return res.status(400).json({ message: 'Este pedido já está cancelado.' });
        }
        
        // Verifica se o status do pedido permite o cancelamento
        // NENHUM pedido pode ser cancelado se estiver a caminho, pronto para retirada ou entregue (mesmo por admins)
        if (order.status === 'on_the_way' || order.status === 'ready_for_pickup' || order.status === 'delivered') {
            console.warn(`[PUT /api/orders/cancel/${orderId}] Não é possível cancelar. Status atual: "${order.status}".`);
            return res.status(400).json({ message: `Não é possível cancelar um pedido com o status "${order.status}".` });
        }

        const updatedOrder = await prisma.pedido.update({
            where: { id: orderId },
            data: { 
                status: 'canceled',
                atualizadoEm: new Date()
            },
            include: {
                itens_pedido: {
                    include: {
                        produto: true,
                        complementos: {
                            include: {
                                complemento: true
                            }
                        }
                    }
                },
                usuario: {
                    select: {
                        id: true,
                        nomeUsuario: true,
                        email: true,
                        telefone: true
                    }
                },
                pagamento: {
                    select: {
                        metodo: true
                    }
                }
            }
        });

        // Enviar notificação de cancelamento ao cliente
        try {
            console.log('❌ Enviando notificação de cancelamento ao cliente...');
            await sendOrderCancellationNotification(updatedOrder);
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de cancelamento:', error);
            // Não falha a operação se a notificação falhar
        }

        console.log(`[PUT /api/orders/cancel/${orderId}] Pedido cancelado com sucesso. Pedido ID: ${updatedOrder.id}`);
        res.status(200).json({ message: 'Pedido cancelado com sucesso!', order: updatedOrder });
    } catch (err) {
        console.error(`[PUT /api/orders/cancel/${orderId}] Erro ao cancelar o pedido:`, err.message);
        res.status(500).json({ message: 'Erro ao cancelar o pedido.', error: err.message });
    }
});

// Listar todos os pedidos (apenas admin)
router.get('/orders', authenticateToken, authorize('admin'), async (req, res) => {
    console.log('[API] /api/orders/orders chamada por:', req.user ? req.user.email : 'desconhecido', 'em', new Date().toISOString());
    try {
        const orders = await prisma.pedido.findMany({
            include: {
                usuario: {
                    select: {
                        id: true,
                        nomeUsuario: true,
                        email: true,
                        telefone: true,
                        enderecos: {
                            where: {
                                padrao: true
                            },
                            select: {
                                id: true,
                                rua: true,
                                numero: true,
                                complemento: true,
                                bairro: true,
                                padrao: true
                            }
                        }
                    }
                },
                itens_pedido: {
                    include: { 
                        produto: {
                            include: {
                                imagens_produto: true
                            }
                        },
                        complementos: {
                            include: {
                                complemento: {
                                    select: {
                                        id: true,
                                        nome: true,
                                        imagemUrl: true
                                    }
                                }
                            }
                        }
                    }
                },
                pagamento: true
            },
            orderBy: {
                criadoEm: 'desc'
            }
        });

        // Transformar os dados para o formato esperado pelo frontend
        const transformedOrders = orders.map(order => ({
            id: order.id,
            userId: order.usuarioId,
            totalPrice: order.precoTotal,
            status: order.status,
            deliveryType: order.tipoEntrega,
            paymentMethod: order.metodoPagamento,
            createdAt: order.criadoEm,
            shippingStreet: order.ruaEntrega,
            shippingNumber: order.numeroEntrega,
            shippingComplement: order.complementoEntrega,
            shippingNeighborhood: order.bairroEntrega,
            shippingPhone: order.telefoneEntrega,
            deliveryFee: order.taxaEntrega,
            notes: order.observacoes,
            precisaTroco: order.precisaTroco || false,
            valorTroco: order.valorTroco ? Number(order.valorTroco) : null,
            user: order.usuario ? {
                id: order.usuario.id,
                username: order.usuario.nomeUsuario,
                email: order.usuario.email,
                phone: order.usuario.telefone,
                enderecos: order.usuario.enderecos ? order.usuario.enderecos.map(addr => ({
                    id: addr.id,
                    street: addr.rua,
                    number: addr.numero,
                    complement: addr.complemento,
                    neighborhood: addr.bairro,
                    isDefault: addr.padrao
                })) : []
            } : null,
            orderitem: order.itens_pedido.map(item => ({
                id: item.id,
                orderId: item.pedidoId,
                productId: item.produtoId,
                quantity: item.quantidade,
                priceAtOrder: item.precoNoPedido,
                selectedOptionsSnapshot: item.opcoesSelecionadas,
                complements: item.complementos ? item.complementos.map(comp => ({
                    id: comp.complemento.id,
                    name: comp.complemento.nome,
                    imageUrl: comp.complemento.imagemUrl
                })) : [],
                product: item.produto ? {
                    id: item.produto.id,
                    name: item.produto.nome,
                    description: item.produto.descricao,
                    price: item.produto.preco,
                    categoryId: item.produto.categoriaId,
                    isActive: item.produto.ativo,
                    images: item.produto.imagens_produto ? item.produto.imagens_produto.map(img => ({
                        id: img.id,
                        productId: img.produtoId,
                        url: img.url,
                        isPrimary: img.principal
                    })) : []
                } : null
            })),
            payment: order.pagamento ? {
                id: order.pagamento.id,
                orderId: order.pagamento.pedidoId,
                method: order.pagamento.metodo,
                status: order.pagamento.status,
                amount: order.pagamento.valor,
                paidAt: order.pagamento.pagoEm
            } : null
        }));

        console.log('[API] /api/orders/orders retornando', transformedOrders.length, 'pedidos. Mais recente:', transformedOrders[0]?.id);
        res.json(transformedOrders);
    } catch (err) {
        console.error('Erro ao buscar pedidos:', err);
        res.status(500).json({ error: 'Erro ao buscar pedidos.' });
    }
});

router.get('/pending-count', authenticateToken, authorize('admin'), async (req, res) => {
  const count = await prisma.pedido.count({
    where: {
      status: { in: ['pending_payment', 'being_prepared'] }
    }
  });
  res.json({ count });
});

module.exports = router;
