import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, MapPin, Package, Plus, Trash2, ShoppingCart, CreditCard, Smartphone, DollarSign, Truck } from 'lucide-react';
import { User as UserType, Product, Address, AddressForm } from '../../../types';
import apiService from '../../../services/api';

interface OrderItem {
  productId: number;
  quantity: number;
  price: number;
  productName: string;
  complementIds?: number[];
}

interface Props {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const ModalCriarPedido: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState(1); // 1: Cliente, 2: Endereço, 3: Produtos, 4: Resumo
  const [clients, setClients] = useState<UserType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedClient, setSelectedClient] = useState<UserType | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryFee, setDeliveryFee] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH_ON_DELIVERY');
  const [notes, setNotes] = useState<string>('');
  const [precisaTroco, setPrecisaTroco] = useState(false);
  const [valorTroco, setValorTroco] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchClient, setSearchClient] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);

  useEffect(() => {
    loadClients();
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedClient && deliveryType === 'delivery') {
      if (selectedClient.enderecos && selectedClient.enderecos.length > 0) {
        const defaultAddress = selectedClient.enderecos.find(addr => addr.isDefault) || selectedClient.enderecos[0];
        setSelectedAddress(defaultAddress);
      } else {
        setSelectedAddress(null);
      }
    } else {
      setSelectedAddress(null);
    }
  }, [selectedClient, deliveryType]);

  const loadClients = async () => {
    try {
      const users = await apiService.getUsers();
      setClients(users);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const prods = await apiService.getProducts();
      setProducts(prods.filter(p => p.isActive));
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const filteredClients = clients.filter(client =>
    client.nomeUsuario.toLowerCase().includes(searchClient.toLowerCase()) ||
    (client.telefone && client.telefone.includes(searchClient))
  );

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const handleAddItem = () => {
    if (!selectedProductId || selectedQuantity <= 0) {
      setError('Selecione um produto e informe a quantidade');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const existingItemIndex = orderItems.findIndex(item => item.productId === selectedProductId);
    
    if (existingItemIndex >= 0) {
      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex].quantity += selectedQuantity;
      setOrderItems(updatedItems);
    } else {
      setOrderItems([...orderItems, {
        productId: selectedProductId,
        quantity: selectedQuantity,
        price: parseFloat(product.price.toString()),
        productName: product.name
      }]);
    }

    setSelectedProductId(0);
    setSelectedQuantity(1);
    setSearchProduct('');
    setError('');
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleUpdateQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) return;
    const updatedItems = [...orderItems];
    updatedItems[index].quantity = quantity;
    setOrderItems(updatedItems);
  };

  const calculateSubtotal = () => {
    return orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const fee = deliveryType === 'delivery' ? parseFloat(deliveryFee || '0') : 0;
    return subtotal + fee;
  };

  const handleNext = () => {
    setError('');
    
    if (step === 1) {
      if (!selectedClient) {
        setError('Selecione um cliente');
        return;
      }
      if (deliveryType === 'delivery' && (!selectedClient.enderecos || selectedClient.enderecos.length === 0)) {
        setError('Cliente não possui endereço cadastrado. Cadastre um endereço primeiro.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (deliveryType === 'delivery' && !selectedAddress) {
        setError('Selecione um endereço de entrega');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (orderItems.length === 0) {
        setError('Adicione pelo menos um item ao pedido');
        return;
      }
      setStep(4);
    }
  };

  const handleSubmit = async () => {
    if (!selectedClient || !paymentMethod) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    if (deliveryType === 'delivery' && !selectedAddress) {
      setError('Selecione um endereço de entrega');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await apiService.createOrderAsAdmin({
        userId: selectedClient.id,
        addressId: deliveryType === 'delivery' ? selectedAddress?.id : undefined,
        items: orderItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          complementIds: item.complementIds || []
        })),
        paymentMethod,
        deliveryType,
        deliveryFee: deliveryType === 'delivery' ? parseFloat(deliveryFee || '0') : 0,
        notes: notes.trim() || undefined,
        precisaTroco: paymentMethod === 'CASH_ON_DELIVERY' ? precisaTroco : false,
        valorTroco: paymentMethod === 'CASH_ON_DELIVERY' && precisaTroco && valorTroco ? parseFloat(valorTroco) : undefined
      });

      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao criar pedido');
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" 
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Criar Novo Pedido</h3>
            <div className="flex items-center gap-2 mt-1">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === s ? 'bg-indigo-600 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step > s ? '✓' : s}
                  </div>
                  {s < 4 && (
                    <div className={`w-12 h-1 ${step > s ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">
              {error}
            </div>
          )}

          {/* Step 1: Selecionar Cliente */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Entrega
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('delivery')}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                      deliveryType === 'delivery'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Truck className="w-5 h-5 mx-auto mb-1" />
                    <div className="font-medium">Entrega</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType('pickup')}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                      deliveryType === 'pickup'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <ShoppingCart className="w-5 h-5 mx-auto mb-1" />
                    <div className="font-medium">Retirada</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buscar Cliente
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchClient}
                    onChange={(e) => setSearchClient(e.target.value)}
                    placeholder="Digite o nome ou telefone do cliente"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="mt-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setSelectedClient(client);
                        setError('');
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 ${
                        selectedClient?.id === client.id ? 'bg-indigo-50 border-indigo-200' : ''
                      }`}
                    >
                      <div className="font-medium text-gray-900">{client.nomeUsuario}</div>
                      <div className="text-sm text-gray-500">{client.telefone || '-'}</div>
                      {client.enderecos && client.enderecos.length > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          {client.enderecos.length} endereço{client.enderecos.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Selecionar Endereço */}
          {step === 2 && deliveryType === 'delivery' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Endereço de Entrega
                </label>
                {selectedClient?.enderecos && selectedClient.enderecos.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedClient.enderecos.map((address) => (
                      <button
                        key={address.id}
                        type="button"
                        onClick={() => {
                          setSelectedAddress(address);
                          setError('');
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                          selectedAddress?.id === address.id
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <MapPin className={`w-5 h-5 mt-0.5 ${selectedAddress?.id === address.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {address.street}, {address.number}
                            </div>
                            <div className="text-sm text-gray-600">
                              {address.neighborhood}
                            </div>
                            {address.complement && (
                              <div className="text-xs text-gray-500">{address.complement}</div>
                            )}
                            {address.isDefault && (
                              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded">
                                Padrão
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Cliente não possui endereços cadastrados
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Taxa de Entrega (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Step 3: Adicionar Produtos */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buscar Produto
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      placeholder="Digite o nome do produto"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(parseInt(e.target.value))}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value={0}>Selecione um produto</option>
                    {filteredProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - R$ {parseFloat(product.price.toString()).toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={selectedQuantity}
                    onChange={(e) => setSelectedQuantity(parseInt(e.target.value) || 1)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Qtd"
                  />
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Itens do Pedido
                </label>
                {orderItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
                    Nenhum item adicionado
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Produto</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-700">Qtd</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">Preço Unit.</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">Subtotal</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-700">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {orderItems.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.productName}</td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateQuantity(index, parseInt(e.target.value) || 1)}
                                className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                              />
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-700">
                              R$ {item.price.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">
                              R$ {(item.price * item.quantity).toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-700">Subtotal:</span>
                        <span className="font-bold text-gray-900">R$ {calculateSubtotal().toFixed(2)}</span>
                      </div>
                      {deliveryType === 'delivery' && (
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-sm text-gray-600">Taxa de Entrega:</span>
                          <span className="text-sm font-medium text-gray-700">R$ {parseFloat(deliveryFee || '0').toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-300">
                        <span className="text-lg font-bold text-gray-900">Total:</span>
                        <span className="text-lg font-bold text-indigo-600">R$ {calculateTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Resumo e Pagamento */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Resumo do Pedido</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cliente:</span>
                    <span className="font-medium">{selectedClient?.nomeUsuario}</span>
                  </div>
                  {deliveryType === 'delivery' && selectedAddress && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Endereço:</span>
                      <span className="font-medium text-right">
                        {selectedAddress.street}, {selectedAddress.number}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipo:</span>
                    <span className="font-medium">{deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Itens:</span>
                    <span className="font-medium">{orderItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">R$ {calculateSubtotal().toFixed(2)}</span>
                  </div>
                  {deliveryType === 'delivery' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Taxa de Entrega:</span>
                      <span className="font-medium">R$ {parseFloat(deliveryFee || '0').toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-gray-300">
                    <span className="font-bold text-gray-900">Total:</span>
                    <span className="font-bold text-indigo-600">R$ {calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de Pagamento *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH_ON_DELIVERY')}
                    className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                      paymentMethod === 'CASH_ON_DELIVERY'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <DollarSign className="w-5 h-5 mx-auto mb-1" />
                    <div className="text-xs font-medium">Dinheiro</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('PIX')}
                    className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                      paymentMethod === 'PIX'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Smartphone className="w-5 h-5 mx-auto mb-1" />
                    <div className="text-xs font-medium">PIX</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CREDIT_CARD')}
                    className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                      paymentMethod === 'CREDIT_CARD'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 mx-auto mb-1" />
                    <div className="text-xs font-medium">Cartão</div>
                  </button>
                </div>
              </div>

              {paymentMethod === 'CASH_ON_DELIVERY' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="precisaTroco"
                      checked={precisaTroco}
                      onChange={(e) => setPrecisaTroco(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="precisaTroco" className="text-sm text-gray-700">
                      Precisa de troco?
                    </label>
                  </div>
                  {precisaTroco && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Valor para troco (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={calculateTotal()}
                        value={valorTroco}
                        onChange={(e) => setValorTroco(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder={`Mínimo: R$ ${calculateTotal().toFixed(2)}`}
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Observações sobre o pedido..."
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Voltar
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Próximo
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Criando Pedido...' : 'Criar Pedido'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null;
};

export default ModalCriarPedido;

