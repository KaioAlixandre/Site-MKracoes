import React, { useState } from 'react';
import { X, MapPin, Home } from 'lucide-react';
import { AddressForm } from '../../../types';

interface Props {
  onClose: () => void;
  onAdd: (data: AddressForm) => Promise<void>;
  clienteNome: string;
  hasExistingAddress: boolean;
}

const ModalAdicionarEnderecoCliente: React.FC<Props> = ({ onClose, onAdd, clienteNome, hasExistingAddress }) => {
  const [form, setForm] = useState({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    reference: '',
    isDefault: false
  });
  const [hasNumber, setHasNumber] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setForm({ ...form, [name]: checked });
    } else {
      setForm({ ...form, [name]: value });
    }
    
    // Limpar erro ao digitar
    if (error) setError('');
  };

  const handleHasNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setHasNumber(checked);
    if (!checked) {
      setForm({ ...form, number: 'S/N' });
    } else {
      setForm({ ...form, number: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validações
    if (!form.street.trim()) {
      setError('Rua é obrigatória');
      setLoading(false);
      return;
    }

    if (!form.number.trim() && hasNumber) {
      setError('Número é obrigatório');
      setLoading(false);
      return;
    }

    if (!form.neighborhood.trim()) {
      setError('Bairro é obrigatório');
      setLoading(false);
      return;
    }

    try {
      await onAdd({
        street: form.street.trim(),
        number: form.number.trim(),
        complement: form.complement.trim() || undefined,
        neighborhood: form.neighborhood.trim(),
        reference: form.reference.trim() || undefined,
        isDefault: form.isDefault || !hasExistingAddress
      });
      // Fechar modal após sucesso
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao cadastrar endereço');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Adicionar Endereço</h3>
            <p className="text-sm text-gray-500 mt-1">Cliente: {clienteNome}</p>
          </div>
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
            <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-2">
              Rua *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                id="street"
                name="street"
                value={form.street}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Nome da rua"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="number" className="block text-sm font-medium text-gray-700 mb-2">
              Número *
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="hasNumber"
                checked={hasNumber}
                onChange={handleHasNumberChange}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="hasNumber" className="text-sm text-gray-700 cursor-pointer">
                Endereço possui número?
              </label>
            </div>
            <div className="relative">
              <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                id="number"
                name="number"
                value={form.number}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${!hasNumber ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                placeholder={hasNumber ? "Número" : "S/N"}
                required={hasNumber}
                disabled={!hasNumber}
              />
            </div>
          </div>

          <div>
            <label htmlFor="complement" className="block text-sm font-medium text-gray-700 mb-2">
              Complemento
            </label>
            <input
              type="text"
              id="complement"
              name="complement"
              value={form.complement}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Apto, Bloco, etc."
            />
          </div>

          <div>
            <label htmlFor="neighborhood" className="block text-sm font-medium text-gray-700 mb-2">
              Bairro *
            </label>
            <input
              type="text"
              id="neighborhood"
              name="neighborhood"
              value={form.neighborhood}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Nome do bairro"
              required
            />
          </div>

          <div>
            <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-2">
              Ponto de Referência
            </label>
            <input
              type="text"
              id="reference"
              name="reference"
              value={form.reference}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Ex: Próximo ao mercado, em frente à escola"
            />
          </div>

          {hasExistingAddress && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                name="isDefault"
                checked={form.isDefault}
                onChange={handleChange}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="isDefault" className="text-sm text-gray-700 cursor-pointer">
                Definir como endereço padrão
              </label>
            </div>
          )}

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
              {loading ? 'Cadastrando...' : 'Cadastrar Endereço'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalAdicionarEnderecoCliente;

