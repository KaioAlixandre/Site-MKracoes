import React, { useEffect, useState } from 'react';
import { useNotification } from '../../components/NotificationProvider';
import apiService from '../../services/api';
import { Deliverer } from '../../types';
import { Plus, Edit, Trash2, User, Phone, ToggleLeft, ToggleRight, X, Truck } from 'lucide-react';
import { applyPhoneMask, validatePhoneWithAPI, removePhoneMask } from '../../utils/phoneValidation';

const Entregadores: React.FC = () => {
  const [deliverers, setDeliverers] = useState<Deliverer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDeliverer, setEditingDeliverer] = useState<Deliverer | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: ''
  });
  const [validatingPhone, setValidatingPhone] = useState(false);

  useEffect(() => {
    loadDeliverers();
  }, []);

  const { notify } = useNotification();
  const loadDeliverers = async () => {
    try {
      setLoading(true);
      const deliverersData = await apiService.getDeliverers();
      setDeliverers(deliverersData);
    } catch (error) {
     
      notify('Erro ao carregar entregadores', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (deliverer?: Deliverer) => {
    if (deliverer) {
      setEditingDeliverer(deliverer);
      setForm({
        name: deliverer.name,
        phone: deliverer.phone
      });
    } else {
      setEditingDeliverer(null);
      setForm({ name: '', phone: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingDeliverer(null);
    setForm({ name: '', phone: '' });
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      // Aplicar máscara de telefone
      const maskedValue = applyPhoneMask(value);
      setForm(prev => ({ ...prev, [name]: maskedValue }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      notify('Nome e telefone são obrigatórios', 'warning');
      return;
    }
    
    // Validar telefone com API
    setValidatingPhone(true);
    try {
      const phoneValidation = await validatePhoneWithAPI(form.phone);
      if (!phoneValidation.valid) {
        notify(phoneValidation.error || 'Número de telefone inválido. Verifique o formato (DDD + número).', 'warning');
        setValidatingPhone(false);
        return;
      }
    } catch (error) {
      notify('Erro ao validar telefone. Tente novamente.', 'error');
      setValidatingPhone(false);
      return;
    }
    setValidatingPhone(false);
    
    try {
      // Remover máscara antes de enviar ao backend
      const telefoneSemMascara = removePhoneMask(form.phone);
      const formDataToSend = {
        ...form,
        phone: telefoneSemMascara
      };
      
      if (editingDeliverer) {
        await apiService.updateDeliverer(editingDeliverer.id, formDataToSend);
        notify('Entregador atualizado com sucesso!', 'success');
      } else {
        await apiService.createDeliverer(formDataToSend);
        notify('Entregador cadastrado com sucesso!', 'success');
      }
      closeModal();
      loadDeliverers();
    } catch (error: any) {
      notify(error.response?.data?.message || 'Erro ao salvar entregador', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Tem certeza que deseja remover este entregador?')) {
      try {
        await apiService.deleteDeliverer(id);
        notify('Entregador removido com sucesso!', 'success');
        loadDeliverers();
      } catch (error: any) {
        notify(error.response?.data?.message || 'Erro ao remover entregador', 'error');
      }
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      await apiService.toggleDelivererStatus(id);
      loadDeliverers();
    } catch (error: any) {
      notify(error.response?.data?.message || 'Erro ao alterar status do entregador', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Carregando entregadores...</div>
      </div>
    );
  }

  return (
    <div id="entregadores" className="page">
      <header className="mb-4 sm:mb-6">
        <div className="mb-3">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800">Entregadores</h2>
          <p className="text-xs sm:text-sm text-slate-500">Gerencie os entregadores cadastrados.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Entregador</span>
        </button>
      </header>

      <div className="bg-white p-3 sm:p-6 rounded-xl shadow-md">
        {deliverers.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum entregador cadastrado</h3>
            <p className="text-gray-500 mb-6">Comece adicionando o primeiro entregador ao sistema</p>
            <button 
              onClick={() => openModal()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-indigo-700 transition-colors mx-auto"
            >
              <Plus className="w-4 h-4" />
              Adicionar Entregador
            </button>
          </div>
        ) : (
          <>
            {/* Desktop View - Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Telefone</th>
                    <th className="p-3">Entregas</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Data de Cadastro</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {deliverers.map(deliverer => (
                    <tr key={deliverer.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="font-medium text-slate-800">{deliverer.name}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600">{deliverer.phone}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-orange-500" />
                          <span className="text-slate-600 font-medium">{deliverer.totalDeliveries || 0}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleToggleStatus(deliverer.id)}
                          className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            deliverer.isActive 
                              ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }`}
                        >
                          {deliverer.isActive ? (
                            <>
                              <ToggleRight className="w-4 h-4" />
                              Ativo
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4" />
                              Inativo
                            </>
                          )}
                        </button>
                      </td>
                      <td className="p-3 text-slate-600">
                        {new Date(deliverer.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-3 text-center space-x-2">
                        <button 
                          onClick={() => openModal(deliverer)}
                          className="p-2 text-slate-500 rounded-md hover:bg-slate-200 hover:text-indigo-600 transition-colors"
                          title="Editar entregador"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(deliverer.id)}
                          className="p-2 text-slate-500 rounded-md hover:bg-slate-200 hover:text-red-600 transition-colors"
                          title="Remover entregador"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View - Cards */}
            <div className="md:hidden divide-y divide-slate-200">
              {deliverers.map(deliverer => (
                <div key={deliverer.id} className="p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-800 text-sm mb-2">{deliverer.name}</h3>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{deliverer.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Truck className="w-3.5 h-3.5 text-orange-500" />
                          <span className="font-medium">{deliverer.totalDeliveries || 0} {deliverer.totalDeliveries === 1 ? 'entrega' : 'entregas'}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleStatus(deliverer.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ml-2 ${
                        deliverer.isActive 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {deliverer.isActive ? (
                        <>
                          <ToggleRight className="w-3.5 h-3.5" />
                          <span>Ativo</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5" />
                          <span>Inativo</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-500">
                      Cadastrado em {new Date(deliverer.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => openModal(deliverer)}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors text-xs font-medium"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(deliverer.id)}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors text-xs font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Deletar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-4 sm:p-6 rounded-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-slate-800">
                {editingDeliverer ? 'Editar Entregador' : 'Novo Entregador'}
              </h3>
              <button 
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  className="w-full p-2 sm:p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Digite o nome do entregador"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                  Telefone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleFormChange}
                  className="w-full p-2 sm:p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="(00) 00000-0000"
                  required
                />
              </div>
              
              <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-3 sm:px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={validatingPhone}
                  className="flex-1 px-3 sm:px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {validatingPhone ? 'Validando...' : editingDeliverer ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Entregadores;