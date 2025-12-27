const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Função para remover máscara do telefone (garantir apenas dígitos)
const removePhoneMask = (phone) => {
    if (!phone) return phone;
    return phone.toString().replace(/\D/g, '');
};

const authenticateToken = async (req, res, next) => {
    console.log('🔗 [Auth Route: authenticateToken] Verificando token de autenticação...');
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        console.warn('⚠️ [Auth Route: authenticateToken] Token não fornecido. Acesso negado.');
        return res.status(401).json({ message: 'Token não fornecido.' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await prisma.usuario.findUnique({
            where: { id: decoded.id },
            select: { id: true, funcao: true, nomeUsuario: true }
        });
        
        if (!user) {
            console.error('❌ [Auth Route: authenticateToken] Usuário não encontrado para o token fornecido.');
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        
        req.user = user;
        console.log(`✅ [Auth Route: authenticateToken] Autenticação bem-sucedida para o usuário ID: ${req.user.id}, Nome: ${req.user.nomeUsuario}, Função: ${req.user.funcao}`);
        next();
    } catch (err) {
        console.error('🚫 [Auth Route: authenticateToken] Token inválido:', err.message);
        return res.status(403).json({ message: 'Token inválido.' });
    }
};

const authorize = (role) => {
    return (req, res, next) => {
        console.log(`🔗 [Auth Route: authorize] Verificando se o usuário tem o papel '${role}'.`);
        console.log(`🔗 [Auth Route: authorize] Usuário atual:`, {
            id: req.user?.id,
            username: req.user?.nomeUsuario,
            role: req.user?.funcao
        });
        
        if (!req.user || req.user.funcao !== role) {
            console.warn(`🚫 [Auth Route: authorize] Acesso negado. Papel necessário: '${role}', Papel do usuário: '${req.user ? req.user.funcao : 'não autenticado'}'`);
            return res.status(403).json({ message: 'Acesso negado: você não tem permissão para realizar esta ação.' });
        }
        
        console.log(`✅ [Auth Route: authorize] Autorização bem-sucedida para o papel '${role}'.`);
        next();
    };
};

router.post('/login', async (req, res) => {
    const { telefone, password } = req.body;
    // Remover máscara do telefone antes de buscar
    const telefoneLimpo = removePhoneMask(telefone);
    console.log(`🔐 [POST /auth/login] Tentativa de login para telefone: ${telefoneLimpo}`);
    
    try {
        const user = await prisma.usuario.findUnique({ where: { telefone: telefoneLimpo } });
        if (!user || !(await bcrypt.compare(password, user.senha))) {
            console.warn(`⚠️ [POST /auth/login] Credenciais inválidas para telefone: ${telefone}`);
            return res.status(400).json({ message: 'Credenciais inválidas.' });
        }
        // Token com expiração de 30 dias para manter usuário logado
        const token = jwt.sign({ id: user.id, role: user.funcao }, JWT_SECRET, { expiresIn: '365d' });
        console.log(`✅ [POST /auth/login] Login realizado com sucesso para usuário: ${user.nomeUsuario} (ID: ${user.id})`);
        res.json({ token, user: { id: user.id, username: user.nomeUsuario, role: user.funcao } });
    } catch (err) {
        console.error('❌ [POST /auth/login] Erro interno ao fazer login:', err);
        res.status(500).json({ message: 'Erro ao fazer login.' });
    }
});

router.post('/register', async (req, res) => {
    const { username, telefone, password } = req.body;
    // Remover máscara do telefone antes de salvar
    const telefoneLimpo = removePhoneMask(telefone);
    console.log(`👤 [POST /auth/register] Tentativa de registro para usuário: ${username}, telefone: ${telefoneLimpo}`);
    
    try {
        const existingUser = await prisma.usuario.findUnique({ where: { telefone: telefoneLimpo } });
        if (existingUser) {
            console.warn(`⚠️ [POST /auth/register] Telefone já existe: ${telefoneLimpo}`);
            return res.status(400).json({ message: 'Telefone já cadastrado.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.usuario.create({
            data: { nomeUsuario: username, telefone: telefoneLimpo, senha: hashedPassword }
        });
        console.log(`✅ [POST /auth/register] Usuário cadastrado com sucesso: ${username} (ID: ${newUser.id})`);
        res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
    } catch (err) {
        console.error('❌ [POST /auth/register] Erro interno ao cadastrar usuário:', err);
        res.status(500).json({ message: 'Erro ao cadastrar usuário.' });
    }
});

router.get('/profile', authenticateToken, async (req, res) => {
    console.log(`👤 [GET /auth/profile] Buscando perfil do usuário ID: ${req.user.id}`);
    
    try {
        const user = await prisma.usuario.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                nomeUsuario: true,
                email: true,
                funcao: true,
                telefone: true,
                enderecos: {
                    select: {
                        id: true,
                        rua: true,
                        numero: true,
                        complemento: true,
                        bairro: true,
                        pontoReferencia: true,
                        padrao: true
                    },
                    orderBy: {
                        padrao: 'desc'
                    }
                }
            }
        });
        console.log(`✅ [GET /auth/profile] Perfil encontrado para usuário: ${user.nomeUsuario}`);
        res.json(user);
    } catch (err) {
        console.error('❌ [GET /auth/profile] Erro interno ao buscar perfil:', err);
        res.status(500).json({ message: 'Erro ao buscar perfil.' });
    }
});

// Rota para admin criar cliente sem senha
router.post('/users', authenticateToken, authorize('admin'), async (req, res) => {
    const { username, telefone } = req.body;
    // Remover máscara do telefone antes de salvar
    const telefoneLimpo = removePhoneMask(telefone);
    console.log(`👤 [POST /auth/users] Admin ${req.user.id} criando cliente: ${username}, telefone: ${telefoneLimpo}`);
    
    try {
        // Verificar se já existe usuário com este telefone
        const existingUser = await prisma.usuario.findUnique({ where: { telefone: telefoneLimpo } });
        if (existingUser) {
            console.warn(`⚠️ [POST /auth/users] Telefone já existe: ${telefoneLimpo}`);
            return res.status(400).json({ message: 'Telefone já cadastrado.' });
        }

        // Verificar se já existe usuário com este nome
        const existingUsername = await prisma.usuario.findUnique({ where: { nomeUsuario: username } });
        if (existingUsername) {
            console.warn(`⚠️ [POST /auth/users] Nome de usuário já existe: ${username}`);
            return res.status(400).json({ message: 'Nome de usuário já cadastrado.' });
        }

        // Gerar senha padrão aleatória (o cliente poderá redefinir depois)
        const defaultPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        
        const newUser = await prisma.usuario.create({
            data: { 
                nomeUsuario: username, 
                telefone: telefoneLimpo, 
                senha: hashedPassword,
                funcao: 'user'
            }
        });
        console.log(`✅ [POST /auth/users] Cliente cadastrado com sucesso: ${username} (ID: ${newUser.id})`);
        res.status(201).json({ message: 'Cliente cadastrado com sucesso!', user: newUser });
    } catch (err) {
        console.error('❌ [POST /auth/users] Erro interno ao cadastrar cliente:', err);
        res.status(500).json({ message: 'Erro ao cadastrar cliente.' });
    }
});

// Rota para admin adicionar endereço para um cliente específico
router.post('/users/:userId/address', authenticateToken, authorize('admin'), async (req, res) => {
    const { userId } = req.params;
    const { street, number, complement, neighborhood, reference, isDefault } = req.body;

    console.log(`📍 [POST /auth/users/${userId}/address] Admin ${req.user.id} adicionando endereço para cliente ID: ${userId}`);

    if (!street || !number || !neighborhood) {
        console.warn('⚠️ [POST /auth/users/:userId/address] Dados obrigatórios do endereço não fornecidos.');
        return res.status(400).json({ message: 'Rua, número e bairro são obrigatórios.' });
    }

    try {
        // Verificar se o usuário existe
        const user = await prisma.usuario.findUnique({ where: { id: parseInt(userId) } });
        if (!user) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }

        // Se isDefault é verdadeiro, definir outros endereços como não padrão
        if (isDefault) {
            await prisma.endereco.updateMany({
                where: { usuarioId: parseInt(userId) },
                data: { padrao: false }
            });
        }

        // Se for o primeiro endereço, definir como padrão automaticamente
        const addressCount = await prisma.endereco.count({
            where: { usuarioId: parseInt(userId) }
        });
        const shouldBeDefault = addressCount === 0 || isDefault;

        if (shouldBeDefault && addressCount > 0) {
            await prisma.endereco.updateMany({
                where: { usuarioId: parseInt(userId) },
                data: { padrao: false }
            });
        }

        const newAddress = await prisma.endereco.create({
            data: {
                rua: street,
                numero: number,
                complemento: complement || null,
                bairro: neighborhood,
                pontoReferencia: reference || null,
                padrao: shouldBeDefault,
                usuarioId: parseInt(userId)
            }
        });

        console.log(`✅ [POST /auth/users/:userId/address] Endereço criado com sucesso: ID ${newAddress.id}`);
        res.status(201).json({ message: 'Endereço cadastrado com sucesso!', address: newAddress });
    } catch (err) {
        console.error('❌ [POST /auth/users/:userId/address] Erro interno:', err);
        res.status(500).json({ message: 'Erro ao cadastrar endereço.' });
    }
});

// Rota para admin atualizar dados do cliente
router.put('/users/:userId', authenticateToken, authorize('admin'), async (req, res) => {
    const { userId } = req.params;
    const { username, telefone } = req.body;
    
    console.log(`✏️ [PUT /auth/users/${userId}] Admin ${req.user.id} atualizando cliente ID: ${userId}`);
    
    try {
        // Verificar se o usuário existe
        const existingUser = await prisma.usuario.findUnique({ where: { id: parseInt(userId) } });
        if (!existingUser) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }

        // Remover máscara do telefone se fornecido
        const telefoneLimpo = telefone ? removePhoneMask(telefone) : existingUser.telefone;

        // Verificar se outro usuário já tem o mesmo telefone
        if (telefone) {
            const userWithSamePhone = await prisma.usuario.findFirst({
                where: { 
                    telefone: telefoneLimpo,
                    id: { not: parseInt(userId) }
                }
            });
            if (userWithSamePhone) {
                return res.status(400).json({ message: 'Telefone já cadastrado para outro cliente.' });
            }
        }

        // Verificar se outro usuário já tem o mesmo nome de usuário
        if (username) {
            const userWithSameUsername = await prisma.usuario.findFirst({
                where: { 
                    nomeUsuario: username,
                    id: { not: parseInt(userId) }
                }
            });
            if (userWithSameUsername) {
                return res.status(400).json({ message: 'Nome de usuário já cadastrado para outro cliente.' });
            }
        }

        // Atualizar dados
        const updateData = {};
        if (username) updateData.nomeUsuario = username;
        if (telefone) updateData.telefone = telefoneLimpo;

        const updatedUser = await prisma.usuario.update({
            where: { id: parseInt(userId) },
            data: updateData
        });

        console.log(`✅ [PUT /auth/users/${userId}] Cliente atualizado com sucesso`);
        res.json({ message: 'Cliente atualizado com sucesso!', user: updatedUser });
    } catch (err) {
        console.error('❌ [PUT /auth/users/:userId] Erro interno:', err);
        res.status(500).json({ message: 'Erro ao atualizar cliente.' });
    }
});

// Rota para admin atualizar endereço de um cliente
router.put('/users/:userId/address/:addressId', authenticateToken, authorize('admin'), async (req, res) => {
    const { userId, addressId } = req.params;
    const { street, number, complement, neighborhood, reference, isDefault } = req.body;

    console.log(`✏️ [PUT /auth/users/${userId}/address/${addressId}] Admin ${req.user.id} atualizando endereço`);

    if (!street || !number || !neighborhood) {
        return res.status(400).json({ message: 'Rua, número e bairro são obrigatórios.' });
    }

    try {
        // Verificar se o endereço existe e pertence ao usuário
        const existingAddress = await prisma.endereco.findFirst({
            where: { 
                id: parseInt(addressId), 
                usuarioId: parseInt(userId) 
            }
        });

        if (!existingAddress) {
            return res.status(404).json({ message: 'Endereço não encontrado.' });
        }

        // Se isDefault é verdadeiro, definir outros endereços como não padrão
        if (isDefault) {
            await prisma.endereco.updateMany({
                where: { 
                    usuarioId: parseInt(userId), 
                    id: { not: parseInt(addressId) } 
                },
                data: { padrao: false }
            });
        }

        const updatedAddress = await prisma.endereco.update({
            where: { id: parseInt(addressId) },
            data: {
                rua: street,
                numero: number,
                complemento: complement || null,
                bairro: neighborhood,
                pontoReferencia: reference || null,
                padrao: isDefault !== undefined ? isDefault : existingAddress.padrao
            }
        });

        console.log(`✅ [PUT /auth/users/:userId/address/:addressId] Endereço atualizado: ID ${addressId}`);
        res.json({ message: 'Endereço atualizado com sucesso!', address: updatedAddress });
    } catch (err) {
        console.error('❌ [PUT /auth/users/:userId/address/:addressId] Erro interno:', err);
        res.status(500).json({ message: 'Erro ao atualizar endereço.' });
    }
});

router.get('/users', authenticateToken, authorize('admin'), async (req, res) => {
    console.log(`👥 [GET /auth/users] Admin ${req.user.id} solicitando lista de usuários`);
    
    try {
        const users = await prisma.usuario.findMany({
            select: {
                id: true,
                nomeUsuario: true,
                email: true,
                funcao: true,
                telefone: true,
                criadoEm: true,
                enderecos: {
                    select: {
                        id: true,
                        rua: true,
                        numero: true,
                        complemento: true,
                        bairro: true,
                        pontoReferencia: true,
                        padrao: true
                    }
                },
                pedidos: {
                    select: {
                        id: true,
                        precoTotal: true,
                        status: true,
                        criadoEm: true,
                        itens_pedido: {
                            select: {
                                id: true,
                                quantidade: true,
                                precoNoPedido: true,
                                produto: {
                                    select: {
                                        id: true,
                                        nome: true
                                    }
                                },
                                complementos: {
                                    select: {
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
                        }
                    }
                }
            }
        });
        
        // Transformar dados do português para inglês para compatibilidade com o frontend
        const transformedUsers = users.map(user => ({
            id: user.id,
            nomeUsuario: user.nomeUsuario,
            email: user.email,
            funcao: user.funcao,
            telefone: user.telefone,
            criadoEm: user.criadoEm,
            enderecos: (user.enderecos || []).map(endereco => ({
                id: endereco.id,
                street: endereco.rua,
                number: endereco.numero,
                complement: endereco.complemento,
                neighborhood: endereco.bairro,
                reference: endereco.pontoReferencia,
                isDefault: endereco.padrao,
                userId: user.id
            })),
            order: (user.pedidos || []).map(pedido => ({
                id: pedido.id,
                totalPrice: Number(pedido.precoTotal) || 0,
                status: pedido.status,
                createdAt: pedido.criadoEm ? pedido.criadoEm.toISOString() : new Date().toISOString()
            }))
        }));
        
        console.log(`✅ [GET /auth/users] ${users.length} usuários encontrados`);
        res.json(transformedUsers);
    } catch (err) {
        console.error('❌ [GET /auth/users] Erro interno ao buscar usuários:', err);
        res.status(500).json({ error: 'Erro ao buscar usuários.' });
    }
});

// GET /auth/profile/addresses - Listar endereços do usuário
router.get('/profile/addresses', authenticateToken, async (req, res) => {
    console.log(`🏠 [GET /auth/profile/addresses] Buscando endereços do usuário ID: ${req.user.id}`);
    
    try {
        const addresses = await prisma.endereco.findMany({
            where: { usuarioId: req.user.id },
            orderBy: { padrao: 'desc' }
        });
        console.log(`✅ [GET /auth/profile/addresses] ${addresses.length} endereços encontrados`);
        
        // Transformar dados do português para inglês
        const transformedAddresses = addresses.map(addr => ({
            id: addr.id,
            street: addr.rua,
            number: addr.numero,
            complement: addr.complemento,
            neighborhood: addr.bairro,
            reference: addr.pontoReferencia,
            isDefault: addr.padrao,
            userId: addr.usuarioId
        }));
        
        res.json(transformedAddresses);
    } catch (err) {
        console.error('❌ [GET /auth/profile/addresses] Erro interno ao buscar endereços:', err);
        res.status(500).json({ error: 'Erro ao buscar endereços.' });
    }
});

// POST /auth/profile/address - Adicionar endereço
router.post('/profile/address', authenticateToken, async (req, res) => {
    const { street, number, complement, neighborhood, reference, isDefault } = req.body;
    const userId = req.user.id;

    console.log(`📍 [POST /auth/profile/address] Adicionando endereço para usuário ID: ${userId}`);

    if (!street || !number || !neighborhood) {
        console.warn('⚠️ [POST /auth/profile/address] Dados obrigatórios do endereço não fornecidos.');
        return res.status(400).json({ message: 'Rua, número e bairro são obrigatórios.' });
    }

    try {
        // Se isDefault é verdadeiro, definir outros endereços como não padrão
        if (isDefault) {
            await prisma.endereco.updateMany({
                where: { usuarioId: userId },
                data: { padrao: false }
            });
        }

        const newAddress = await prisma.endereco.create({
            data: {
                rua: street,
                numero: number,
                complemento: complement || null,
                bairro: neighborhood,
                pontoReferencia: reference || null,
                padrao: isDefault || false,
                usuarioId: userId
            }
        });

        // Buscar o usuário atualizado com endereços para resposta
        const updatedUser = await prisma.usuario.findUnique({
            where: { id: userId },
            include: { 
                enderecos: true
            }
        });

        console.log(`✅ [POST /auth/profile/address] Endereço criado com sucesso: ID ${newAddress.id}`);
        res.status(201).json({ user: updatedUser });
    } catch (err) {
        console.error('❌ [POST /auth/profile/address] Erro interno:', err);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});


// PUT /auth/profile/address/:addressId - Atualizar endereço
router.put('/profile/address/:addressId', authenticateToken, async (req, res) => {
    const { addressId } = req.params;
    const { street, number, complement, neighborhood, reference, isDefault } = req.body;
    const userId = req.user.id;

    console.log(`✏️ [PUT /auth/profile/address/${addressId}] Atualizando endereço para usuário ID: ${userId}`);

    if (!street || !number || !neighborhood) {
        console.warn('⚠️ [PUT /auth/profile/address] Dados obrigatórios não fornecidos.');
        return res.status(400).json({ message: 'Rua, número e bairro são obrigatórios.' });
    }

    try {
        // Verificar se o endereço pertence ao usuário
        const existingAddress = await prisma.endereco.findFirst({
            where: { id: parseInt(addressId), usuarioId: userId }
        });

        if (!existingAddress) {
            console.warn(`⚠️ [PUT /auth/profile/address] Endereço não encontrado: ID ${addressId}`);
            return res.status(404).json({ message: 'Endereço não encontrado.' });
        }

        // Se isDefault é verdadeiro, definir outros endereços como não padrão
        if (isDefault) {
            await prisma.endereco.updateMany({
                where: { usuarioId: userId, id: { not: parseInt(addressId) } },
                data: { padrao: false }
            });
        }

        const updatedAddress = await prisma.endereco.update({
            where: { id: parseInt(addressId) },
            data: {
                rua: street,
                numero: number,
                complemento: complement || null,
                bairro: neighborhood,
                pontoReferencia: reference || null,
                padrao: isDefault || false
            }
        });

        console.log(`✅ [PUT /auth/profile/address] Endereço atualizado: ID ${addressId}`);
        res.json(updatedAddress);
    } catch (err) {
        console.error('❌ [PUT /auth/profile/address] Erro interno:', err);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// PUT /auth/profile/phone - Atualizar telefone do usuário autenticado
router.put('/profile/phone', authenticateToken, async (req, res) => {
    const { phone } = req.body;
    const userId = req.user.id;
    // Remover máscara do telefone antes de salvar
    const telefoneLimpo = removePhoneMask(phone);

    console.log(`📱 [PUT /auth/profile/phone] Atualizando telefone para usuário ID: ${userId}`);

    if (!telefoneLimpo) {
        console.warn('⚠️ [PUT /auth/profile/phone] Telefone não fornecido.');
        return res.status(400).json({ message: 'Telefone é obrigatório.' });
    }

    try {
        const updatedUser = await prisma.usuario.update({
            where: { id: userId },
            data: { telefone: telefoneLimpo },
            select: {
                id: true,
                nomeUsuario: true,
                email: true,
                telefone: true,
                funcao: true,
                enderecos: true
            }
        });

        console.log(`✅ [PUT /auth/profile/phone] Telefone atualizado para usuário ID: ${userId}`);
        res.json({ success: true, user: updatedUser });
    } catch (err) {
        console.error('❌ [PUT /auth/profile/phone] Erro interno:', err);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// DELETE /auth/profile/address/:addressId - Excluir endereço
router.delete('/profile/address/:addressId', authenticateToken, async (req, res) => {
    const { addressId } = req.params;
    const userId = req.user.id;

    console.log(`🗑️ [DELETE /auth/profile/address/${addressId}] Excluindo endereço para usuário ID: ${userId}`);

    try {
        // Verificar se o endereço existe e pertence ao usuário
        const existingAddress = await prisma.endereco.findFirst({
            where: { 
                id: parseInt(addressId), 
                usuarioId: userId 
            }
        });

        if (!existingAddress) {
            console.warn(`⚠️ [DELETE /auth/profile/address] Endereço não encontrado ou não pertence ao usuário: ID ${addressId}`);
            return res.status(404).json({ message: 'Endereço não encontrado.' });
        }

        // Verificar se é o último endereço do usuário
        const userAddressCount = await prisma.endereco.count({
            where: { usuarioId: userId }
        });

        if (userAddressCount === 1) {
            console.warn(`⚠️ [DELETE /auth/profile/address] Tentativa de excluir último endereço: ID ${addressId}`);
            return res.status(400).json({ 
                message: 'Não é possível excluir o último endereço. Adicione outro endereço antes de excluir este.' 
            });
        }

        // Excluir o endereço
        await prisma.endereco.delete({
            where: { id: parseInt(addressId) }
        });

        // Se o endereço excluído era o padrão, definir outro como padrão
        if (existingAddress.padrao) {
            const firstRemainingAddress = await prisma.endereco.findFirst({
                where: { usuarioId: userId },
                orderBy: { id: 'asc' }
            });

            if (firstRemainingAddress) {
                await prisma.endereco.update({
                    where: { id: firstRemainingAddress.id },
                    data: { padrao: true }
                });
                console.log(`🔄 [DELETE /auth/profile/address] Novo endereço padrão definido: ID ${firstRemainingAddress.id}`);
            }
        }

        // Buscar endereços atualizados do usuário
        const updatedAddresses = await prisma.endereco.findMany({
            where: { usuarioId: userId },
            orderBy: [
                { padrao: 'desc' },
                { id: 'asc' }
            ]
        });

        console.log(`✅ [DELETE /auth/profile/address] Endereço excluído com sucesso: ID ${addressId}`);
        res.json({ 
            message: 'Endereço excluído com sucesso.',
            addresses: updatedAddresses
        });
    } catch (err) {
        console.error('❌ [DELETE /auth/profile/address] Erro interno:', err);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

module.exports = {
    router,
    authenticateToken,
    authorize
};