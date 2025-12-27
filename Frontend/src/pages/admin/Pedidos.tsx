import React, { useState, useMemo, useEffect } from 'react';
import { Printer, ArrowRightCircle, RotateCw, Truck, MapPin, Filter, Calendar, X, Eye, CreditCard, Smartphone, DollarSign, Edit, Trash2, Plus, Save } from 'lucide-react';
import { Order, Product } from '../../types';
import { printOrderReceipt } from '../../utils/printOrderReceipt';
import apiService from '../../services/api';
import ModalCriarPedido from './components/ModalCriarPedido';

// Função para traduzir status para português
const getStatusInPortuguese = (status: string) => {
  const statusMap: { [key: string]: string } = {
    'pending_payment': 'Pagamento Pendente',
    'being_prepared': 'Preparando',
    'ready_for_pickup': 'Pronto para Retirada',
    'on_the_way': 'A Caminho',
    'delivered': 'Entregue',
    'canceled': 'Cancelado'
  };
  return statusMap[status] || status;
};

// Função para obter estilo do status
const getStatusStyle = (status: string) => {
  const statusStyles: { [key: string]: string } = {
    'pending_payment': 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    'being_prepared': 'bg-blue-100 text-blue-800 border border-blue-200',
    'ready_for_pickup': 'bg-orange-100 text-orange-800 border border-orange-200',
    'on_the_way': 'bg-purple-100 text-purple-800 border border-purple-200',
    'delivered': 'bg-green-100 text-green-800 border border-green-200',
    'canceled': 'bg-red-100 text-red-800 border border-red-200'
  };
  return statusStyles[status] || 'bg-gray-100 text-gray-800 border border-gray-200';
};

const Pedidos: React.FC<{ 
  orders: Order[], 
  handleAdvanceStatus: (order: Order) => void,
  onRefresh?: () => void
}> = ({ orders, handleAdvanceStatus, onRefresh }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        // Pequeno delay para mostrar o feedback visual
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };
  
  // Estados para os filtros
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Estados para edição
  const [isEditing, setIsEditing] = useState(false);
  const [editedTotal, setEditedTotal] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemProductId, setNewItemProductId] = useState<number>(0);
  const [newItemQuantity, setNewItemQuantity] = useState<number>(1);
  const [newItemPrice, setNewItemPrice] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Carregar produtos quando abrir modal de edição
  useEffect(() => {
    if (isEditing && selectedOrder) {
      loadProducts();
      setEditedTotal(selectedOrder.totalPrice.toString());
    }
  }, [isEditing, selectedOrder]);

  // Polling automático para verificar novos pedidos a cada 5 segundos
  useEffect(() => {
    if (!onRefresh) return;

    const intervalId = setInterval(() => {
      // Atualizar pedidos silenciosamente
      onRefresh();
    }, 5000); // Verificar a cada 5 segundos

    // Limpar intervalo quando o componente for desmontado
    return () => clearInterval(intervalId);
  }, [onRefresh]);

  const loadProducts = async () => {
    try {
      const prods = await apiService.getProducts();
      setProducts(prods.filter(p => p.isActive));
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const handleEditOrder = () => {
    setIsEditing(true);
    if (selectedOrder) {
      setEditedTotal(selectedOrder.totalPrice.toString());
    }
  };

  const handleSaveTotal = async () => {
    if (!selectedOrder) return;
    
    const newTotal = parseFloat(editedTotal);
    if (isNaN(newTotal) || newTotal <= 0) {
      alert('Valor inválido');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.updateOrderTotal(selectedOrder.id, newTotal);
      if (response.data) {
        if (onRefresh) onRefresh();
        alert('Valor atualizado com sucesso!');
        // Fechar modal e retornar para a lista
        setIsEditing(false);
        setSelectedOrder(null);
        setShowAddItem(false);
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao atualizar valor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!selectedOrder || !newItemProductId || newItemQuantity <= 0) {
      alert('Preencha todos os campos');
      return;
    }

    setIsLoading(true);
    try {
      const product = products.find(p => p.id === newItemProductId);
      const price = newItemPrice ? parseFloat(newItemPrice) : (product?.price || 0);
      
      const response = await apiService.addItemToOrder(selectedOrder.id, {
        productId: newItemProductId,
        quantity: newItemQuantity,
        price: price
      });

      if (response.data) {
        if (onRefresh) onRefresh();
        alert('Item adicionado com sucesso!');
        // Fechar modal e retornar para a lista
        setIsEditing(false);
        setSelectedOrder(null);
        setShowAddItem(false);
        setNewItemProductId(0);
        setNewItemQuantity(1);
        setNewItemPrice('');
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao adicionar item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: number) => {
    if (!selectedOrder) return;
    
    if (!confirm('Tem certeza que deseja remover este item?')) return;

    setIsLoading(true);
    try {
      const response = await apiService.removeItemFromOrder(selectedOrder.id, itemId);
      if (response.data) {
        if (onRefresh) onRefresh();
        alert('Item removido com sucesso!');
        // Fechar modal e retornar para a lista
        setIsEditing(false);
        setSelectedOrder(null);
        setShowAddItem(false);
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao remover item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    
    if (!confirm('Tem certeza que deseja cancelar este pedido?')) return;

    setIsLoading(true);
    try {
      const response = await apiService.cancelOrder(selectedOrder.id);
      if (response.data) {
        if (onRefresh) onRefresh();
        alert('Pedido cancelado com sucesso!');
        // Fechar modal e retornar para a lista
        setIsEditing(false);
        setSelectedOrder(null);
        setShowAddItem(false);
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao cancelar pedido');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para verificar se uma data é hoje
  const isToday = (date: string) => {
    const orderDate = new Date(date);
    const today = new Date();
    orderDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return orderDate.getTime() === today.getTime();
  };

  // Função para verificar se uma data é esta semana
  const isThisWeek = (date: string) => {
    const orderDate = new Date(date);
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return orderDate >= startOfWeek && orderDate <= endOfWeek;
  };

  // Pedidos filtrados
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Filtro por status
      const statusMatch = statusFilter === 'all' || order.status === statusFilter;

      // Filtro por data
      let dateMatch = true;
      if (dateFilter === 'today') {
        dateMatch = isToday(order.createdAt);
      } else if (dateFilter === 'week') {
        dateMatch = isThisWeek(order.createdAt);
      }

      return statusMatch && dateMatch;
    });
  }, [orders, statusFilter, dateFilter]);

  // Limpar todos os filtros (exceto o filtro de data que sempre será 'today')
  const clearFilters = () => {
    setStatusFilter('all');
    setDateFilter('today'); // Sempre manter como 'today'
  };

  // Contar filtros ativos (considerando 'today' como padrão, não conta como filtro ativo)
  const activeFiltersCount = (statusFilter !== 'all' ? 1 : 0) + (dateFilter !== 'today' && dateFilter !== 'all' ? 1 : 0);

  return (
    <div id="pedidos" className="page">
      <header className="mb-4 sm:mb-6">
        <div className="mb-3">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800">Pedidos</h2>
          <p className="text-slate-500">
            Gerencie os pedidos recebidos. 
            {filteredOrders.length !== orders.length && (
              <span className="ml-2 text-indigo-600 font-medium">
                {filteredOrders.length} de {orders.length} pedidos
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowCreateModal(true);
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Pedido
          </button>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors relative ${
              showFilters ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-indigo-700 transition-colors ${
              isRefreshing ? 'opacity-75 cursor-not-allowed' : ''
            }`}
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </header>

      {/* Painel de Filtros */}
      {showFilters && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </h3>
            {activeFiltersCount > 0 && (
              <button 
                onClick={clearFilters}
                className="text-red-600 hover:text-red-700 flex items-center gap-1 text-sm font-medium"
              >
                <X className="w-4 h-4" />
                Limpar Filtros
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Filtro por Status */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Status do Pedido
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="all"
                    checked={statusFilter === 'all'}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="mr-2 text-indigo-600"
                  />
                  <span className="text-sm text-slate-600">Todos os status</span>
                </label>
                {[
                  { value: 'pending_payment', label: 'Pagamento Pendente', color: 'text-yellow-600' },
                  { value: 'being_prepared', label: 'Preparando', color: 'text-blue-600' },
                  { value: 'ready_for_pickup', label: 'Pronto para Retirada', color: 'text-orange-600' },
                  { value: 'on_the_way', label: 'A Caminho', color: 'text-purple-600' },
                  { value: 'delivered', label: 'Entregue', color: 'text-green-600' },
                  { value: 'canceled', label: 'Cancelado', color: 'text-red-600' }
                ].map((status) => (
                  <label key={status.value} className="flex items-center">
                    <input
                      type="radio"
                      name="status"
                      value={status.value}
                      checked={statusFilter === status.value}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="mr-2 text-indigo-600"
                    />
                    <span className={`text-sm ${status.color} font-medium`}>{status.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filtro por Data */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                <Calendar className="w-4 h-4 inline mr-1" />
                Período
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="date"
                    value="all"
                    checked={dateFilter === 'all'}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="mr-2 text-indigo-600"
                  />
                  <span className="text-sm text-slate-600">Todos os períodos</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="date"
                    value="today"
                    checked={dateFilter === 'today'}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="mr-2 text-indigo-600"
                  />
                  <span className="text-sm text-indigo-600 font-medium">Hoje</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="date"
                    value="week"
                    checked={dateFilter === 'week'}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="mr-2 text-indigo-600"
                  />
                  <span className="text-sm text-indigo-600 font-medium">Esta semana</span>
                </label>
              </div>
            </div>
          </div>

          {/* Resumo dos filtros ativos */}
          {activeFiltersCount > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                <span className="font-medium">Filtros ativos:</span>
                {statusFilter !== 'all' && (
                  <span className="ml-2 bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs">
                    Status: {getStatusInPortuguese(statusFilter)}
                  </span>
                )}
                {dateFilter !== 'today' && dateFilter !== 'all' && (
                  <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                    Período: {dateFilter === 'week' ? 'Esta semana' : 'Todos'}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white p-2 sm:p-3 rounded-xl shadow-md">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-slate-400 mb-4">
              <Filter className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Nenhum pedido encontrado</h3>
            <p className="text-slate-500 mb-4">
              {activeFiltersCount > 0 
                ? 'Não há pedidos que correspondam aos filtros selecionados.'
                : 'Não há pedidos para exibir.'
              }
            </p>
            {activeFiltersCount > 0 && (
              <button 
                onClick={clearFilters}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="p-2 sm:p-4 text-xs sm:text-sm">Cliente</th>
                  <th className="p-2 sm:p-4 text-xs sm:text-sm max-w-[200px] sm:max-w-none">Itens</th>
                  <th className="p-2 sm:p-4 text-xs sm:text-sm hidden md:table-cell">Tipo</th>
                  <th className="p-2 sm:p-4 text-xs sm:text-sm w-[100px] sm:w-auto">Status</th>
                  <th className="p-2 sm:p-4 text-right text-xs sm:text-sm">Total</th>
                  <th className="p-2 sm:p-4 text-center text-xs sm:text-sm">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="p-2 sm:p-4">
                      <div className="font-medium text-slate-800 text-sm sm:text-base">{order.user?.username || '-'}</div>
                      <div className="text-sm text-slate-500">
                        {new Date(order.createdAt).toLocaleString('pt-BR')}
                      </div>
                    </td>
                    <td className="p-2 sm:p-4 max-w-[200px] sm:max-w-none">
                      <div className="text-[10px] sm:text-xs md:text-sm text-slate-600">
                        {(order.orderitem || []).map(item => {
                          // Verificar se é produto personalizado
                          const isCustomAcai = item.selectedOptionsSnapshot?.customAcai;
                          const isCustomSorvete = item.selectedOptionsSnapshot?.customSorvete;
                          const isCustomProduct = item.selectedOptionsSnapshot?.customProduct;
                          const customData = isCustomAcai || isCustomSorvete || isCustomProduct;
                          
                          // Verificar se o produto existe
                          if (!item.product) {
                            return null;
                          }
                          
                          return (
                            <div key={item.id} className="mb-1.5 sm:mb-2 last:mb-0">
                              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                <span className="font-medium truncate max-w-full">
                                  {item.product.name} x {item.quantity}
                                </span>
                                {customData && (
                                  <span className={`inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium flex-shrink-0 ${ 
                                    isCustomAcai ? 'bg-purple-100 text-purple-800' :
                                    isCustomSorvete ? 'bg-blue-100 text-blue-800' : 
                                    'bg-green-100 text-green-800'
                                  }`}>
                                    Personalizado R$ {Number(customData.value).toFixed(2)}
                                  </span>
                                )}
                              </div>
                              
                              {/* Complementos de produtos personalizados */}
                              {customData && customData.complementNames && Array.isArray(customData.complementNames) && customData.complementNames.length > 0 && (
                                <div className="mt-0.5 sm:mt-1">
                                  <span className="text-[9px] sm:text-[10px] text-slate-500">Complementos: </span>
                                  <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-0.5">
                                    {customData.complementNames.map((complement: string, idx: number) => (
                                      <span 
                                        key={idx}
                                        className="inline-flex items-center px-1 py-0.5 rounded text-[9px] sm:text-[10px] bg-green-50 text-green-700 border border-green-200"
                                      >
                                        {complement}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Complementos regulares do produto */}
                              {item.complements && item.complements.length > 0 && (
                                <div className="mt-0.5 sm:mt-1">
                                  <span className="text-[9px] sm:text-[10px] text-slate-500">Complementos: </span>
                                  <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-0.5">
                                    {item.complements.map((complement) => (
                                      <span 
                                        key={complement.id}
                                        className="inline-flex items-center px-1 py-0.5 rounded text-[9px] sm:text-[10px] bg-purple-50 text-purple-700 border border-purple-200"
                                      >
                                        {complement.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-2 sm:p-4 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        {order.deliveryType === 'delivery' ? (
                          <>
                            <Truck className="w-4 h-4 text-blue-600" />
                            <span className="text-xs sm:text-sm font-medium text-blue-600">Entrega</span>
                          </>
                        ) : (
                          <>
                            <MapPin className="w-4 h-4 text-green-600" />
                            <span className="text-xs sm:text-sm font-medium text-green-600">Retirada</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-2 sm:p-4 w-[100px] sm:w-auto">
                      <span className={`inline-block px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full whitespace-nowrap ${getStatusStyle(order.status)}`}>
                        {getStatusInPortuguese(order.status)}
                      </span>
                    </td>
                    <td className="p-2 sm:p-4 text-right font-medium text-slate-800 text-sm sm:text-base">
                      R$ {Number(order.totalPrice).toFixed(2)}
                    </td>
                    <td className="p-2 sm:p-4 text-center">
                      <div className="flex items-center justify-center gap-1 sm:gap-2">
                        <button 
                          title={
                            (order.notes && order.notes.trim()) || order.precisaTroco
                              ? `Ver Detalhes${order.notes && order.notes.trim() ? ' (com observações)' : ''}${order.precisaTroco ? ' (precisa de troco)' : ''}`
                              : "Ver Detalhes"
                          }
                          onClick={() => setSelectedOrder(order)}
                          className="p-1.5 sm:p-2 text-slate-500 rounded-md hover:bg-slate-200 hover:text-indigo-600 relative"
                        >
                          <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                          <div className="absolute -top-0.5 -right-0.5 flex gap-0.5">
                            {order.notes && order.notes.trim() && (
                              <span className="w-2 h-2 bg-yellow-500 rounded-full border border-white" title="Possui observações"></span>
                            )}
                            {order.precisaTroco && (
                              <span className="w-2 h-2 bg-orange-500 rounded-full border border-white" title="Precisa de troco"></span>
                            )}
                          </div>
                        </button>
                        <button 
                          title="Imprimir Pedido"
                          onClick={() => {
                            printOrderReceipt({
                              order,
                              user: order.user ? {
                                nomeUsuario: order.user.username,
                                telefone: (order.user as any).telefone || (order.user as any).phone,
                                email: (order.user as any).email
                              } : undefined
                            });
                          }}
                          className="p-1.5 sm:p-2 text-slate-500 rounded-md hover:bg-slate-200 hover:text-blue-600"
                        >
                          <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button title="Avançar Status" onClick={() => handleAdvanceStatus(order)} className="p-1.5 sm:p-2 text-slate-500 rounded-md hover:bg-slate-200 hover:text-green-600">
                          <ArrowRightCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Pedido */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-2 sm:p-4">
          <div className="bg-white rounded-md shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 p-2.5 sm:p-3 md:p-4 text-white flex justify-between items-start sm:items-center gap-2 rounded-t-md">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm sm:text-base md:text-lg font-bold truncate">Pedido #{selectedOrder.id}</h2>
                <p className="text-indigo-100 text-[10px] sm:text-xs mt-0.5">
                  {new Date(selectedOrder.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <button 
                    onClick={handleEditOrder}
                    className="p-1.5 sm:p-2 hover:bg-indigo-500 rounded-lg transition-colors flex-shrink-0"
                    title="Editar Pedido"
                  >
                    <Edit className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                )}
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setSelectedOrder(null);
                    setShowAddItem(false);
                  }}
                  className="p-1.5 sm:p-2 hover:bg-indigo-500 rounded-lg transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-2.5 sm:p-3 md:p-4 space-y-2.5 sm:space-y-3">
              {/* Informações do Cliente */}
              <div className="bg-slate-50 rounded-lg p-2.5 sm:p-3 border border-slate-200">
                <h3 className="text-xs sm:text-sm md:text-base font-bold text-slate-800 mb-1.5 sm:mb-2 flex items-center gap-1 sm:gap-1.5">
                  <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 flex-shrink-0" />
                  Informações do Cliente
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <p className="text-[10px] sm:text-xs text-slate-600">Cliente</p>
                    <p className="font-semibold text-slate-800 text-xs sm:text-sm break-words">{selectedOrder.user?.username || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-slate-600">Telefone</p>
                    <p className="font-semibold text-slate-800 text-xs sm:text-sm">{(selectedOrder.user as any)?.telefone || (selectedOrder.user as any)?.phone || '-'}</p>
                  </div>
                  
                  {/* Endereço Principal do Cliente */}
                  {(selectedOrder.user as any)?.enderecos && (selectedOrder.user as any).enderecos.length > 0 && (
                    <div className="md:col-span-2">
                      <p className="text-[10px] sm:text-xs text-slate-600 mb-1">Endereço Principal</p>
                      <div className="bg-white rounded-lg p-2 border-l-4 border-indigo-500">
                        <p className="font-semibold text-slate-800 text-[10px] sm:text-xs break-words">
                          {(selectedOrder.user as any).enderecos[0].street}, {(selectedOrder.user as any).enderecos[0].number}
                          {(selectedOrder.user as any).enderecos[0].complement && ` - ${(selectedOrder.user as any).enderecos[0].complement}`}
                        </p>
                        <p className="text-[10px] sm:text-xs text-slate-600 mt-0.5">
                          {(selectedOrder.user as any).enderecos[0].neighborhood}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status e Tipo de Entrega */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                <div className="bg-slate-50 rounded-lg p-2 sm:p-2.5 border border-slate-200">
                  <p className="text-[10px] sm:text-xs text-slate-600 mb-1">Status do Pedido</p>
                  <span className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getStatusStyle(selectedOrder.status)}`}>
                    {getStatusInPortuguese(selectedOrder.status)}
                  </span>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 sm:p-2.5 border border-slate-200">
                  <p className="text-[10px] sm:text-xs text-slate-600 mb-1">Tipo de Entrega</p>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    {selectedOrder.deliveryType === 'delivery' ? (
                      <>
                        <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                        <span className="font-semibold text-blue-600 text-xs sm:text-sm">Entrega</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                        <span className="font-semibold text-green-600 text-xs sm:text-sm">Retirada</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 sm:p-2.5 border border-slate-200 sm:col-span-2 md:col-span-1">
                  <p className="text-[10px] sm:text-xs text-slate-600 mb-1">Forma de Pagamento</p>
                  <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                    {(selectedOrder as any).paymentMethod === 'CREDIT_CARD' && (
                      <>
                        <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 flex-shrink-0" />
                        <span className="font-semibold text-purple-600 text-xs sm:text-sm">Cartão de Crédito</span>
                      </>
                    )}
                    {(selectedOrder as any).paymentMethod === 'PIX' && (
                      <>
                        <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                        <span className="font-semibold text-green-600 text-xs sm:text-sm">PIX</span>
                      </>
                    )}
                    {(selectedOrder as any).paymentMethod === 'CASH_ON_DELIVERY' && (
                      <>
                        <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-600 flex-shrink-0" />
                        <span className="font-semibold text-yellow-600 text-xs sm:text-sm">Dinheiro</span>
                      </>
                    )}
                    {!(selectedOrder as any).paymentMethod && (
                      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                        <span className="text-[10px] sm:text-xs text-slate-500">⚠️ Não registrado</span>
                        <span className="text-[9px] sm:text-[10px] text-slate-400">(pedido antigo)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Informação de Troco */}
              {selectedOrder.paymentMethod === 'CASH_ON_DELIVERY' && selectedOrder.precisaTroco && (
                <div className="bg-yellow-50 rounded-lg p-2.5 sm:p-3 border-2 border-yellow-300">
                  <h3 className="text-xs sm:text-sm md:text-base font-bold text-yellow-900 mb-1.5 sm:mb-2 flex items-center gap-1 sm:gap-1.5">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-700" />
                    Troco Necessário
                  </h3>
                  <div className="bg-white rounded-lg p-2 sm:p-2.5 border border-yellow-200">
                    <p className="text-[10px] sm:text-xs md:text-sm text-slate-700 font-semibold">
                      {selectedOrder.valorTroco ? (
                        <>
                          Cliente pagará com: <span className="text-yellow-700">R$ {Number(selectedOrder.valorTroco).toFixed(2)}</span>
                          <br />
                          <span className="text-slate-600 text-[10px] sm:text-xs">
                            Troco de: R$ {(Number(selectedOrder.valorTroco) - Number(selectedOrder.totalPrice)).toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="text-yellow-700">Cliente precisa de troco</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Itens do Pedido */}
              <div className="bg-slate-50 rounded-lg p-2.5 sm:p-3 border border-slate-200">
                <h3 className="text-xs sm:text-sm md:text-base font-bold text-slate-800 mb-2">Itens do Pedido</h3>
                <div className="space-y-1.5 sm:space-y-2">
                  {(selectedOrder.orderitem || []).map(item => {
                    const isCustomAcai = item.selectedOptionsSnapshot?.customAcai;
                    const isCustomSorvete = item.selectedOptionsSnapshot?.customSorvete;
                    const isCustomProduct = item.selectedOptionsSnapshot?.customProduct;
                    const customData = isCustomAcai || isCustomSorvete || isCustomProduct;
                    
                    if (!item.product) return null;
                    
                    return (
                      <div key={item.id} className="bg-white rounded-lg p-2 sm:p-2.5 border border-slate-200">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 flex-wrap">
                              <span className="font-bold text-slate-800 text-[11px] sm:text-xs break-words">{item.product.name}</span>
                              {customData && (
                                <span className={`inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium flex-shrink-0 ${
                                  isCustomAcai ? 'bg-purple-100 text-purple-800' :
                                  isCustomSorvete ? 'bg-blue-100 text-blue-800' : 
                                  'bg-green-100 text-green-800'
                                }`}>
                                  Personalizado
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] sm:text-xs text-slate-600">
                              Qtd: {item.quantity} × R$ {Number(item.priceAtOrder).toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-indigo-600 text-xs sm:text-sm">
                              R$ {(Number(item.priceAtOrder) * item.quantity).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        
                        {/* Complementos de produtos personalizados */}
                        {customData && customData.complementNames && Array.isArray(customData.complementNames) && customData.complementNames.length > 0 && (
                          <div className="mt-1 pt-1 border-t border-slate-200">
                            <p className="text-[9px] sm:text-[10px] font-semibold text-slate-600 mb-0.5 sm:mb-1">Complementos:</p>
                            <div className="flex flex-wrap gap-0.5">
                              {customData.complementNames.map((complement: string, idx: number) => (
                                <span 
                                  key={idx}
                                  className="inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] bg-green-50 text-green-700 border border-green-200 font-medium break-all">
                                
                                  {complement}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Complementos regulares do produto */}
                        {item.complements && item.complements.length > 0 && (
                          <div className="mt-1 pt-1 border-t border-slate-200">
                            <p className="text-[9px] sm:text-[10px] font-semibold text-slate-600 mb-0.5 sm:mb-1">Complementos:</p>
                            <div className="flex flex-wrap gap-0.5">
                              {item.complements.map((complement) => (
                                <span 
                                  key={complement.id}
                                  className="inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] bg-purple-50 text-purple-700 border border-purple-200 font-medium break-all"
                                >
                                  {complement.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {isEditing && (
                          <div className="mt-2 pt-2 border-t border-red-200">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              disabled={isLoading}
                              className="w-full bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remover Item
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Observações do Pedido */}
              {selectedOrder.notes && selectedOrder.notes.trim() && (
                <div className="bg-yellow-50 rounded-lg p-2.5 sm:p-3 border-2 border-yellow-200">
                  <h3 className="text-xs sm:text-sm md:text-base font-bold text-yellow-900 mb-1.5 sm:mb-2 flex items-center gap-1 sm:gap-1.5">
                    <span className="text-base sm:text-lg">📝</span>
                    Observações do Cliente
                  </h3>
                  <div className="bg-white rounded-lg p-2 sm:p-2.5 border border-yellow-200">
                    <p className="text-[10px] sm:text-xs md:text-sm text-slate-700 whitespace-pre-wrap break-words">
                      {selectedOrder.notes}
                    </p>
                  </div>
                </div>
              )}

              {/* Resumo Financeiro */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-2.5 sm:p-3 border border-indigo-200">
                <div className="flex justify-between items-center mb-1.5 sm:mb-2">
                  <h3 className="text-xs sm:text-sm md:text-base font-bold text-slate-800">Resumo Financeiro</h3>
                  {isEditing && (
                    <button
                      onClick={handleSaveTotal}
                      disabled={isLoading}
                      className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <Save className="w-3 h-3 inline mr-1" />
                      Salvar
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-700 text-[10px] sm:text-xs">
                    <span>Subtotal:</span>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editedTotal}
                        onChange={(e) => setEditedTotal(e.target.value)}
                        className="w-24 px-2 py-1 text-xs border rounded"
                      />
                    ) : (
                      <span className="font-semibold">R$ {Number(selectedOrder.totalPrice).toFixed(2)}</span>
                    )}
                  </div>
                  {selectedOrder.deliveryType === 'delivery' && (
                    <div className="flex justify-between text-slate-700 text-[10px] sm:text-xs">
                      <span>Taxa de Entrega:</span>
                      <span className="font-semibold">R$ 3,00</span>
                    </div>
                  )}
                  <div className="border-t border-indigo-300 pt-1 flex justify-between">
                    <span className="text-sm sm:text-base font-bold text-slate-900">Total:</span>
                    <span className="text-sm sm:text-base md:text-lg font-bold text-indigo-600">
                      R$ {isEditing ? Number(editedTotal || 0).toFixed(2) : Number(selectedOrder.totalPrice).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Adicionar Item (modo edição) */}
              {isEditing && (
                <div className="bg-blue-50 rounded-lg p-2.5 sm:p-3 border border-blue-200">
                  {!showAddItem ? (
                    <button
                      onClick={() => setShowAddItem(true)}
                      className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Item
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800">Adicionar Novo Item</h4>
                      <select
                        value={newItemProductId}
                        onChange={(e) => {
                          setNewItemProductId(Number(e.target.value));
                          const product = products.find(p => p.id === Number(e.target.value));
                          if (product) setNewItemPrice(product.price.toString());
                        }}
                        className="w-full px-2 py-1 text-xs border rounded"
                      >
                        <option value={0}>Selecione um produto</option>
                        {products.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name} - R$ {product.price.toFixed(2)}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          value={newItemQuantity}
                          onChange={(e) => setNewItemQuantity(Number(e.target.value))}
                          placeholder="Quantidade"
                          className="flex-1 px-2 py-1 text-xs border rounded"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={newItemPrice}
                          onChange={(e) => setNewItemPrice(e.target.value)}
                          placeholder="Preço"
                          className="flex-1 px-2 py-1 text-xs border rounded"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddItem}
                          disabled={isLoading}
                          className="flex-1 bg-green-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                        >
                          Adicionar
                        </button>
                        <button
                          onClick={() => {
                            setShowAddItem(false);
                            setNewItemProductId(0);
                            setNewItemQuantity(1);
                            setNewItemPrice('');
                          }}
                          className="flex-1 bg-gray-400 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-gray-500"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Ações */}
              <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2">
                {!isEditing ? (
                  <>
                    <button 
                      onClick={() => handleAdvanceStatus(selectedOrder)}
                      className="flex-1 bg-green-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm"
                    >
                      <ArrowRightCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span>Avançar Status</span>
                    </button>
                    <button 
                      onClick={() => {
                        printOrderReceipt({
                          order: selectedOrder,
                          user: selectedOrder.user ? {
                            nomeUsuario: selectedOrder.user.username,
                            telefone: (selectedOrder.user as any).telefone || (selectedOrder.user as any).phone,
                            email: (selectedOrder.user as any).email
                          } : undefined
                        });
                      }}
                      className="flex-1 bg-blue-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm"
                    >
                      <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span>Imprimir</span>
                    </button>
                    {selectedOrder.status !== 'canceled' && 
                     selectedOrder.status !== 'on_the_way' && 
                     selectedOrder.status !== 'ready_for_pickup' && 
                     selectedOrder.status !== 'delivered' && (
                      <button 
                        onClick={handleCancelOrder}
                        disabled={isLoading}
                        className="flex-1 bg-red-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span>Cancelar Pedido</span>
                      </button>
                    )}
                  </>
                ) : (
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setShowAddItem(false);
                      setEditedTotal(selectedOrder.totalPrice.toString());
                    }}
                    className="flex-1 bg-gray-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm"
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span>Sair da Edição</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <ModalCriarPedido
          onClose={() => {
            setShowCreateModal(false);
          }}
          onSuccess={async () => {
            if (onRefresh) {
              await onRefresh();
            }
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Pedidos;