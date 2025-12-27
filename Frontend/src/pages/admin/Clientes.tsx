import React, { useState } from 'react';
import { Users, TrendingUp, Plus, MapPin, Edit } from 'lucide-react';
import { User, AddressForm, Address } from '../../types';
import ModalAdicionarCliente from './components/ModalAdicionarCliente';
import ModalAdicionarEnderecoCliente from './components/ModalAdicionarEnderecoCliente';
import ModalEditarCliente from './components/ModalEditarCliente';
import ModalEditarEnderecoCliente from './components/ModalEditarEnderecoCliente';
import apiService from '../../services/api';

interface ClientesProps {
  user: User[];
  onRefresh?: () => Promise<void>;
}

const Clientes: React.FC<ClientesProps> = ({ user, onRefresh }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditAddressModal, setShowEditAddressModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<User | null>(null);
  const [selectedEndereco, setSelectedEndereco] = useState<Address | null>(null);
  const [showMenuForCliente, setShowMenuForCliente] = useState<number | null>(null);
  // Calcular LTV Médio baseado nos dados reais
  const calculateAverageLTV = () => {
    if (user.length === 0) return 0;
    
    const totalLTV = user.reduce((acc, cliente) => {
      const clienteLTV = cliente.order?.reduce((orderAcc, order) => orderAcc + Number(order.totalPrice), 0) || 0;
      return acc + clienteLTV;
    }, 0);
    
    return totalLTV / user.length;
  };

  const averageLTV = calculateAverageLTV();

  // Ordenar clientes por número de pedidos (decrescente) e, em caso de empate, por valor gasto (decrescente)
  const clientesOrdenados = [...user].sort((a, b) => {
    const pedidosA = a.order?.length || 0;
    const pedidosB = b.order?.length || 0;
    
    // Calcular total gasto de cada cliente
    const totalGastoA = (a.order || []).reduce((acc, order) => {
      const valor = Number(order.totalPrice) || 0;
      return acc + (isNaN(valor) ? 0 : valor);
    }, 0);
    
    const totalGastoB = (b.order || []).reduce((acc, order) => {
      const valor = Number(order.totalPrice) || 0;
      return acc + (isNaN(valor) ? 0 : valor);
    }, 0);
    
    // Primeiro ordena por número de pedidos (decrescente)
    if (pedidosB !== pedidosA) {
      return pedidosB - pedidosA;
    }
    
    // Se o número de pedidos for igual, ordena por valor gasto (decrescente)
    return totalGastoB - totalGastoA;
  });

  const handleAddCliente = async (data: { username: string; telefone: string }) => {
    await apiService.createUser(data);
    if (onRefresh) {
      await onRefresh();
    }
  };

  const handleAddEndereco = async (data: AddressForm) => {
    if (!selectedCliente) return;
    await apiService.addAddressForUser(selectedCliente.id, data);
    if (onRefresh) {
      await onRefresh();
    }
  };

  const handleOpenAddressModal = (cliente: User) => {
    setSelectedCliente(cliente);
    setShowAddressModal(true);
    setShowMenuForCliente(null);
  };

  const handleOpenEditModal = (cliente: User) => {
    setSelectedCliente(cliente);
    setShowEditModal(true);
    setShowMenuForCliente(null);
  };

  const handleOpenEditAddressModal = (cliente: User, endereco: Address) => {
    setSelectedCliente(cliente);
    setSelectedEndereco(endereco);
    setShowEditAddressModal(true);
    setShowMenuForCliente(null);
  };

  const handleUpdateCliente = async (data: { username: string; telefone: string }) => {
    if (!selectedCliente) return;
    await apiService.updateUser(selectedCliente.id, data);
    if (onRefresh) {
      await onRefresh();
    }
  };

  const handleUpdateEndereco = async (data: AddressForm) => {
    if (!selectedCliente || !selectedEndereco) return;
    await apiService.updateUserAddress(selectedCliente.id, selectedEndereco.id, data);
    if (onRefresh) {
      await onRefresh();
    }
  };

  return (
  <div id="clientes" className="page">
    <header className="mb-4 sm:mb-6 flex items-center justify-between">
      <div>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800">Clientes</h2>
        <p className="text-xs sm:text-sm text-slate-500">Visualize e gerencie sua base de clientes.</p>
      </div>
      <button
        onClick={() => setShowAddModal(true)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">Adicionar Cliente</span>
        <span className="sm:hidden">Adicionar</span>
      </button>
    </header>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-md flex items-center gap-2 sm:gap-3">
        <div className="bg-indigo-100 p-2 rounded-full">
          <Users className="text-indigo-600 w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div>
          <p className="text-slate-500 text-xs">Total de Clientes</p>
          <p className="text-lg sm:text-xl font-bold text-slate-800">{user.length}</p>
        </div>
      </div>
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-md flex items-center gap-2 sm:gap-3">
        <div className="bg-green-100 p-2 rounded-full">
          <TrendingUp className="text-green-600 w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div>
          <p className="text-slate-500 text-xs">LTV Médio</p>
          <p className="text-lg sm:text-xl font-bold text-slate-800">R$ {isNaN(averageLTV) ? '0.00' : averageLTV.toFixed(2)}</p>
        </div>
      </div>
    </div>
    <div className="bg-white p-2 sm:p-3 rounded-xl shadow-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="p-2 sm:p-3 text-xs">Nome do Cliente</th>
              <th className="p-2 sm:p-3 text-xs hidden md:table-cell">Contato</th>
              <th className="p-2 sm:p-3 text-center text-xs">Pedidos</th>
              <th className="p-2 sm:p-3 text-right text-xs">Total Gasto</th>
              <th className="p-2 sm:p-3 text-center text-xs">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {clientesOrdenados.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  Nenhum cliente cadastrado
                </td>
              </tr>
            ) : (
              clientesOrdenados.map(cliente => {
                // Calcular total gasto e quantidade de pedidos
                const pedidos = cliente.order || [];
                const totalGasto = pedidos.reduce((acc, order) => {
                  const valor = Number(order.totalPrice) || 0;
                  return acc + (isNaN(valor) ? 0 : valor);
                }, 0);
                const totalPedidos = pedidos.length;
                
                // Calcular ticket médio
                const ticketMedio = totalPedidos > 0 ? totalGasto / totalPedidos : 0;
                
                return (
                  <tr key={cliente.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 sm:p-3">
                      <div className="font-medium text-slate-800 text-xs sm:text-sm">{cliente.nomeUsuario}</div>
                      <div className="text-xs text-slate-500 md:hidden">{cliente.telefone || '-'}</div>
                      {cliente.email && (
                        <div className="text-xs text-slate-400 mt-0.5">{cliente.email}</div>
                      )}
                    </td>
                    <td className="p-2 sm:p-3 text-slate-600 text-xs hidden md:table-cell">
                      <div>{cliente.telefone || '-'}</div>
                      {cliente.email && (
                        <div className="text-xs text-slate-400 mt-0.5">{cliente.email}</div>
                      )}
                    </td>
                    <td className="p-2 sm:p-3 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-slate-800 font-semibold text-sm sm:text-base">{totalPedidos}</span>
                        {totalPedidos > 0 && (
                          <span className="text-xs text-slate-500 mt-0.5">
                            Ticket médio: R$ {ticketMedio.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 sm:p-3 text-right">
                      <div className="font-medium text-slate-800 text-sm sm:text-base">
                        R$ {totalGasto.toFixed(2)}
                      </div>
                      {totalPedidos > 0 && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {totalPedidos} pedido{totalPedidos !== 1 ? 's' : ''}
                        </div>
                      )}
                    </td>
                    <td className="p-2 sm:p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="p-1.5 text-slate-500 rounded-md hover:bg-slate-200 hover:text-indigo-600 transition-colors"
                          onClick={() => handleOpenEditModal(cliente)}
                          title="Editar Cliente"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <div className="relative">
                          <button
                            className="p-1.5 text-slate-500 rounded-md hover:bg-slate-200 hover:text-indigo-600 transition-colors"
                            onClick={() => setShowMenuForCliente(showMenuForCliente === cliente.id ? null : cliente.id)}
                            title="Gerenciar Endereços"
                          >
                            <MapPin className="w-4 h-4" />
                          </button>
                          
                          {showMenuForCliente === cliente.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowMenuForCliente(null)}
                              />
                              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl z-50 border border-gray-200 overflow-hidden">
                                <div className="py-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenAddressModal(cliente);
                                      setShowMenuForCliente(null);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-3 transition-colors"
                                  >
                                    <Plus className="w-4 h-4 text-indigo-600" />
                                    <span>
                                      {cliente.enderecos && cliente.enderecos.length > 0 
                                        ? 'Adicionar Endereço' 
                                        : 'Cadastrar Endereço'}
                                    </span>
                                  </button>
                                  {cliente.enderecos && cliente.enderecos.length > 0 && (
                                    <>
                                      <div className="border-t border-gray-200 my-1"></div>
                                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        Endereços ({cliente.enderecos.length})
                                      </div>
                                      <div className="max-h-48 overflow-y-auto">
                                        {cliente.enderecos.map((endereco) => (
                                          <button
                                            key={endereco.id}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenEditAddressModal(cliente, endereco);
                                              setShowMenuForCliente(null);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-start gap-3 transition-colors group"
                                          >
                                            <MapPin className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <div className="truncate">
                                                {endereco.street}, {endereco.number}
                                              </div>
                                              {endereco.isDefault && (
                                                <span className="text-xs text-indigo-600 font-medium">Padrão</span>
                                              )}
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>

    {showAddModal && (
      <ModalAdicionarCliente
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddCliente}
      />
    )}

    {showAddressModal && selectedCliente && (
      <ModalAdicionarEnderecoCliente
        onClose={() => {
          setShowAddressModal(false);
          setSelectedCliente(null);
        }}
        onAdd={handleAddEndereco}
        clienteNome={selectedCliente.nomeUsuario}
        hasExistingAddress={(selectedCliente.enderecos?.length || 0) > 0}
      />
    )}

    {showEditModal && selectedCliente && (
      <ModalEditarCliente
        onClose={() => {
          setShowEditModal(false);
          setSelectedCliente(null);
        }}
        onUpdate={handleUpdateCliente}
        cliente={selectedCliente}
      />
    )}

    {showEditAddressModal && selectedCliente && selectedEndereco && (
      <ModalEditarEnderecoCliente
        onClose={() => {
          setShowEditAddressModal(false);
          setSelectedCliente(null);
          setSelectedEndereco(null);
        }}
        onUpdate={handleUpdateEndereco}
        clienteNome={selectedCliente.nomeUsuario}
        endereco={selectedEndereco}
        hasMultipleAddresses={(selectedCliente.enderecos?.length || 0) > 1}
      />
    )}

    {/* Overlay para fechar menu ao clicar fora */}
    {showMenuForCliente !== null && (
      <div
        className="fixed inset-0 z-40"
        onClick={() => setShowMenuForCliente(null)}
      />
    )}
  </div>
  );
}

export default Clientes;