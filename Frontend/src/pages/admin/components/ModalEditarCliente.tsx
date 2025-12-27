import React, { useState, useEffect } from 'react';
import { X, User, Phone } from 'lucide-react';
import { applyPhoneMask, validatePhoneLocal } from '../../../utils/phoneValidation';
import { User as UserType } from '../../../types';

interface Props {
  onClose: () => void;
  onUpdate: (data: { username: string; telefone: string }) => Promise<void>;
  cliente: UserType;
}

const ModalEditarCliente: React.FC<Props> = ({ onClose, onUpdate, cliente }) => {
  const [form, setForm] = useState({
    username: cliente.nomeUsuario || '',
    telefone: cliente.telefone || ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Aplicar máscara no telefone ao carregar
    if (form.telefone) {
      const maskedValue = applyPhoneMask(form.telefone);
      setForm({ ...form, telefone: maskedValue });
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'telefone') {
      const maskedValue = applyPhoneMask(value);
      setForm({ ...form, telefone: maskedValue });
    } else {
      setForm({ ...form, [name]: value });
    }
    
    // Limpar erro ao digitar
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validações
    if (!form.username.trim()) {
      setError('Nome de usuário é obrigatório');
      setLoading(false);
      return;
    }

    if (!form.telefone.trim()) {
      setError('Telefone é obrigatório');
      setLoading(false);
      return;
    }

    // Validar telefone
    const phoneValidation = validatePhoneLocal(form.telefone);
    if (!phoneValidation.valid) {
      setError(phoneValidation.error || 'Telefone inválido');
      setLoading(false);
      return;
    }

    try {
      await onUpdate({
        username: form.username.trim(),
        telefone: form.telefone
      });
      // Fechar modal após sucesso
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao atualizar cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">Editar Cliente</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Nome do Cliente *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                id="username"
                name="username"
                value={form.username}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Digite o nome do cliente"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="telefone" className="block text-sm font-medium text-gray-700 mb-2">
              Telefone *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                id="telefone"
                name="telefone"
                value={form.telefone}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="(11) 99999-9999"
                maxLength={15}
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalEditarCliente;

