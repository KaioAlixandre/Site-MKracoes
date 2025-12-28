import React, { useState, useEffect } from 'react';
import { Product, ProductCategory } from '../../../types';
import { X, Upload } from 'lucide-react';

interface Props {
  categories: ProductCategory[];
  product: Product;
  onClose: () => void;
  onUpdate: (id: number, formData: FormData) => void;
}

const EditProductModal: React.FC<Props> = ({ categories, product, onClose, onUpdate }) => {
  const [form, setForm] = useState({
    name: product.name,
    price: product.price.toString(),
    categoryId: product.category?.id?.toString() || '',
    isActive: product.isActive,
    isFeatured: product.isFeatured || false,
    receiveComplements: product.receiveComplements || false,
    description: product.description || '',
    images: [] as File[],
    quantidadeComplementos: product.quantidadeComplementos !== undefined && product.quantidadeComplementos !== null ? String(product.quantidadeComplementos) : ''
  });
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);

  // Carregar imagens existentes do produto
  useEffect(() => {
    if (product.images && product.images.length > 0) {
      // Usar a URL Cloudinary diretamente
      const imageUrls = product.images.map(img => img.url);
      setExistingImages(imageUrls);
    }
  }, [product]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'file' && e.target instanceof HTMLInputElement) {
      const files = Array.from(e.target.files || []);
      
      // Limitar a 5 imagens (incluindo as existentes)
      const totalImages = existingImages.length + form.images.length + files.length;
      if (totalImages > 5) {
        alert('Você pode ter no máximo 5 imagens');
        return;
      }
      
      const newImages = [...form.images, ...files];
      setForm({ ...form, images: newImages });
      
      // Criar previews das novas imagens
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    } else if (type === 'checkbox' && e.target instanceof HTMLInputElement) {
      setForm({ ...form, [name]: e.target.checked });
      // Se desmarcar receiveComplements, limpa quantidadeComplementos
      if (name === 'receiveComplements' && !e.target.checked) {
        setForm(f => ({ ...f, quantidadeComplementos: '' }));
      }
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const removeNewImage = (index: number) => {
    setForm({
      ...form,
      images: form.images.filter((_, i) => i !== index)
    });
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('nome', form.name);
    formData.append('preco', form.price);
    formData.append('categoriaId', form.categoryId);
    formData.append('descricao', form.description);
    formData.append('ativo', String(form.isActive));
    formData.append('isFeatured', String(form.isFeatured));
    formData.append('receiveComplements', String(form.receiveComplements));
    if (form.receiveComplements) {
      formData.append('quantidadeComplementos', form.quantidadeComplementos || '0');
    }
    // Adicionar todas as novas imagens
    form.images.forEach((image) => {
      formData.append('images', image);
    });
    onUpdate(product.id, formData);
  };

  const totalImages = existingImages.length + form.images.length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl my-8">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 sm:py-3 flex justify-between items-center rounded-t-xl">
          <h3 className="text-lg sm:text-xl font-bold text-slate-800">Editar Produto</h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Form */}
        <form className="p-3 sm:p-4 space-y-2 sm:space-y-3" onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Nome */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Nome do Produto *
              </label>
              <input 
                name="name" 
                value={form.name} 
                onChange={handleChange} 
                placeholder="Ex: Açaí 500ml" 
                required 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
              />
            </div>

            {/* Preço */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Preço (R$) *
              </label>
              <input 
                name="price" 
                value={form.price} 
                onChange={handleChange} 
                placeholder="0.00" 
                required 
                type="number" 
                step="0.01" 
                min="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Categoria *
            </label>
            <select 
              name="categoryId" 
              value={form.categoryId} 
              onChange={handleChange} 
              required 
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white text-sm"
            >
              <option value="">Selecione uma categoria</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Descrição
              <span className="text-xs font-normal text-slate-500 ml-2">
                {form.description.length}/70 caracteres
              </span>
            </label>
            <textarea 
              name="description" 
              value={form.description} 
              onChange={handleChange} 
              placeholder="Descreva o produto..." 
              rows={2}
              maxLength={70}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none text-sm"
            />
          </div>

          {/* Imagens */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Imagens do Produto (até 5)
              <span className="text-xs font-normal text-slate-500 ml-2">
                {totalImages}/5
              </span>
            </label>
            <div className="flex flex-col gap-3">
              {totalImages < 5 && (
                <label className="flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all cursor-pointer">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="text-xs text-slate-600">
                    Clique para adicionar imagens ({5 - totalImages} restantes)
                  </span>
                  <input 
                    type="file" 
                    name="images" 
                    accept="image/*" 
                    multiple
                    onChange={handleChange} 
                    className="hidden"
                  />
                </label>
              )}
              
              {/* Grid de previews - Imagens existentes e novas */}
              {(existingImages.length > 0 || imagePreviews.length > 0) && (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {/* Imagens existentes */}
                  {existingImages.map((imageUrl, index) => (
                    <div key={`existing-${index}`} className="relative group">
                      <div className="relative w-full h-20 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <img 
                          src={imageUrl} 
                          alt={`Imagem ${index + 1}`} 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all" />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Novas imagens */}
                  {imagePreviews.map((preview, index) => (
                    <div key={`new-${index}`} className="relative group">
                      <div className="relative w-full h-20 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <img 
                          src={preview} 
                          alt={`Nova ${index + 1}`} 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all" />
                        <button
                          type="button"
                          onClick={() => removeNewImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status Ativo, Destaque e Complementos */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <input 
                type="checkbox" 
                id="isActive"
                name="isActive" 
                checked={form.isActive} 
                onChange={handleChange}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-slate-700 cursor-pointer">
                Produto ativo e disponível para venda
              </label>
            </div>
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
              <input 
                type="checkbox" 
                id="isFeatured"
                name="isFeatured" 
                checked={form.isFeatured} 
                onChange={handleChange}
                className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-2 focus:ring-amber-500"
              />
              <label htmlFor="isFeatured" className="text-sm font-medium text-slate-700 cursor-pointer">
                Produto em destaque (aparecerá primeiro)
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-3 border-t border-slate-200">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="flex-1 px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30 text-sm"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProductModal;