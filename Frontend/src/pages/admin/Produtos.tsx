import React from 'react';
import { Pencil, Trash2, Plus, Power, PowerOff } from 'lucide-react';
import { Product, ProductCategory } from '../../types';
import ModalAdicionarProduto from './components/ModalAdicionarProduto';
import ModalEditarProduto from './components/ModalEditarProduto';
import ModalGerenciarCategorias from './components/ModalGerenciarCategorias';

const Produtos: React.FC<{
  products: Product[],
  categories: ProductCategory[],
  showAddModal: boolean,
  setShowAddModal: (show: boolean) => void,
  showAddCategoryModal: boolean,
  setShowAddCategoryModal: (show: boolean) => void,
  editProduct: Product | null,
  setEditProduct: (product: Product | null) => void,
  handleAddProduct: (data: any) => void,
  handleEdit: (product: Product) => void,
  handleUpdateProduct: (id: number, data: any) => void,
  handleDelete: (id: number) => void,
  onCategoriesChange: () => void
}> = ({
  products, categories, showAddModal, setShowAddModal, showAddCategoryModal, setShowAddCategoryModal,
  editProduct, setEditProduct, handleAddProduct, handleEdit, handleUpdateProduct, handleDelete, onCategoriesChange
}) => (
  <div id="produtos" className="page">
    <header className="mb-4 sm:mb-6">
      <div className="mb-3">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800">Produtos</h2>
        <p className="text-xs sm:text-sm text-slate-500">Cadastre e gerencie seus produtos, categorias e variações.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
          onClick={() => setShowAddModal(true)}
        >
          <Pencil className="w-5 h-5" />
          <span className="text-sm sm:text-base">Novo Produto</span>
        </button>
        <button
          className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
          onClick={() => setShowAddCategoryModal(true)}
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm sm:text-base">Nova Categoria</span>
        </button>
      </div>
    </header>
    <div className="bg-white p-2 sm:p-3 rounded-xl shadow-md">
      {/* Versão Desktop - Tabela */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="p-3 text-xs">Produto</th>
              <th className="p-3 text-xs">Categoria</th>
              <th className="p-3 text-right text-xs">Preço Base</th>
              <th className="p-3 text-center text-xs">Status</th>
              <th className="p-3 text-center text-xs">Destaque</th>
              <th className="p-3 text-center text-xs">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {products.map((prod) => (
              <tr key={prod.id} className="hover:bg-slate-50">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {Array.isArray(prod.images) && prod.images.length > 0 && prod.images[0].url ? (
                      <img
                        src={prod.images[0].url}
                        alt={prod.name}
                        className="h-12 w-12 object-cover rounded shadow"
                        style={{ minWidth: 48 }}
                      />
                    ) : (
                      <div className="h-12 w-12 bg-slate-200 rounded flex items-center justify-center text-slate-400 text-xs">Sem imagem</div>
                    )}
                    <span className="font-medium text-slate-800 text-sm">{prod.name}</span>
                  </div>
                </td>
                <td className="p-3 text-slate-600 text-sm">{prod.category?.name || '-'}</td>
                <td className="p-3 text-right font-medium text-slate-800 text-sm">R$ {prod.price ? Number(prod.price).toFixed(2) : '--'}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${prod.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {prod.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="p-3 text-center">
                  {prod.isFeatured && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">
                       Destaque
                    </span>
                  )}
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      className={`p-1.5 rounded-md transition-colors ${
                        prod.isActive
                          ? 'text-green-600 hover:bg-green-50 hover:text-green-700'
                          : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                      }`}
                      onClick={() => {
                        const formData = new FormData();
                        formData.append('ativo', (!prod.isActive).toString());
                        handleUpdateProduct(prod.id, formData);
                      }}
                      title={prod.isActive ? 'Produto ativo' : 'Produto inativo'}
                    >
                      {prod.isActive ? (
                        <Power className="w-4 h-4" />
                      ) : (
                        <PowerOff className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      className="p-1.5 text-slate-500 rounded-md hover:bg-slate-200 hover:text-indigo-600"
                      onClick={() => handleEdit(prod)}
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 text-slate-500 rounded-md hover:bg-slate-200 hover:text-red-600"
                      onClick={() => handleDelete(prod.id)}
                      title="Deletar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Versão Mobile - Cards */}
      <div className="md:hidden divide-y divide-slate-200">
        {products.map((prod) => (
          <div key={prod.id} className="p-3 hover:bg-slate-50 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 flex items-center gap-3">
                {Array.isArray(prod.images) && prod.images.length > 0 && prod.images[0].url ? (
                  <img
                    src={prod.images[0].url}
                    alt={prod.name}
                    className="h-12 w-12 object-cover rounded shadow"
                    style={{ minWidth: 48 }}
                  />
                ) : (
                  <div className="h-12 w-12 bg-slate-200 rounded flex items-center justify-center text-slate-400 text-xs">Sem imagem</div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-slate-800 text-sm">{prod.name}</h3>
                    {prod.isFeatured && (
                      <span className="text-amber-500" title="Produto em destaque">⭐</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{prod.category?.name || 'Sem categoria'}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${prod.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {prod.isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-base font-bold text-slate-800">
                R$ {prod.price ? Number(prod.price).toFixed(2) : '--'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg transition-colors text-xs font-medium ${
                    prod.isActive
                      ? 'text-green-600 hover:text-green-900 hover:bg-green-50'
                      : 'text-red-600 hover:text-red-900 hover:bg-red-50'
                  }`}
                  onClick={() => {
                    const formData = new FormData();
                    formData.append('ativo', (!prod.isActive).toString());
                    handleUpdateProduct(prod.id, formData);
                  }}
                >
                  {prod.isActive ? (
                    <>
                      <Power className="w-3.5 h-3.5" />
                      <span>Ativo</span>
                    </>
                  ) : (
                    <>
                      <PowerOff className="w-3.5 h-3.5" />
                      <span>Inativo</span>
                    </>
                  )}
                </button>
                <button
                  className="flex items-center justify-center gap-1 px-3 py-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors text-xs font-medium"
                  onClick={() => handleEdit(prod)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  className="flex items-center justify-center gap-1 px-3 py-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors text-xs font-medium"
                  onClick={() => handleDelete(prod.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Deletar</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
    {showAddModal && (
      <ModalAdicionarProduto
        categories={categories}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddProduct}
      />
    )}
    {editProduct && (
      <ModalEditarProduto
        categories={categories}
        product={editProduct}
        onClose={() => setEditProduct(null)}
        onUpdate={handleUpdateProduct}
      />
    )}
    {showAddCategoryModal && (
      <ModalGerenciarCategorias
        categories={categories}
        onClose={() => setShowAddCategoryModal(false)}
        onCategoriesChange={onCategoriesChange}
      />
    )}
  </div>
);

export default Produtos;