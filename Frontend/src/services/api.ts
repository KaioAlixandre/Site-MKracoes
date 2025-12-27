import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  User, 
  Product, 
  CartItem, 
  Order, 
  Address, 
  LoginForm, 
  RegisterForm, 
  AddressForm,
  LoginResponse,
  CartResponse,
  ProductCategory,
  ApiResponse 
} from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para adicionar token de autenticação
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Interceptor para tratar respostas de erro
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        // Só remove o token se for realmente um erro de autenticação (401)
        // E não é uma rota pública (login, register, etc)
        if (error.response?.status === 401) {
          const url = error.config?.url || '';
          const isPublicRoute = url.includes('/auth/login') || 
                               url.includes('/auth/register') || 
                               url.includes('/auth/forgot-password') ||
                               url.includes('/auth/reset-password');
          
          // Se não for rota pública, o token pode estar inválido
          if (!isPublicRoute) {
            // Verificar se estamos na página de login/register para evitar loop
            const currentPath = window.location.pathname;
            if (!currentPath.includes('/login') && !currentPath.includes('/cadastrar')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
              // Só redirecionar se não estiver já na página de login
              if (currentPath !== '/login' && currentPath !== '/cadastrar') {
            window.location.href = '/login';
              }
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(credentials: LoginForm): Promise<LoginResponse> {
    const response: AxiosResponse<LoginResponse> = await this.api.post('/auth/login', credentials);
    return response.data;
  }

  async register(userData: RegisterForm): Promise<ApiResponse<User>> {
    const response: AxiosResponse<ApiResponse<User>> = await this.api.post('/auth/register', userData);
    return response.data;
  }

  async getProfile(): Promise<User> {
    const response: AxiosResponse<User> = await this.api.get('/auth/profile');
    return response.data;
  }

  async updatePhone(phone: string): Promise<ApiResponse<User>> {
    const response: AxiosResponse<ApiResponse<User>> = await this.api.put('/auth/profile/phone', { phone });
    return response.data;
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response: AxiosResponse<{ message: string }> = await this.api.post('/auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<{ message: string }> {
    const response: AxiosResponse<{ message: string }> = await this.api.post('/auth/reset-password', {
      email,
      code,
      newPassword
    });
    return response.data;
  }

  async verifyResetCode(email: string, code: string): Promise<{ valid: boolean; message?: string }> {
    const response: AxiosResponse<{ valid: boolean; message?: string }> = await this.api.post('/auth/verify-reset-code', {
      email,
      code
    });
    return response.data;
  }

  async getUsers(): Promise<User[]> {
  const response: AxiosResponse<User[]> = await this.api.get('/auth/users');
  return response.data;
  }

  async createUser(userData: { username: string; telefone: string }): Promise<ApiResponse<User>> {
    const response: AxiosResponse<ApiResponse<User>> = await this.api.post('/auth/users', userData);
    return response.data;
  }

  // Address endpoints
  async addAddress(addressData: AddressForm): Promise<{ user: User }> {
  const response = await this.api.post('/auth/profile/address', addressData);
  return response.data;
}

  async getAddresses(): Promise<Address[]> {
    const response: AxiosResponse<Address[]> = await this.api.get('/auth/profile/addresses');
    return response.data;
  }

  async addAddressForUser(userId: number, addressData: AddressForm): Promise<ApiResponse<Address>> {
    const response: AxiosResponse<ApiResponse<Address>> = await this.api.post(`/auth/users/${userId}/address`, addressData);
    return response.data;
  }

  async updateUser(userId: number, userData: { username?: string; telefone?: string }): Promise<ApiResponse<User>> {
    const response: AxiosResponse<ApiResponse<User>> = await this.api.put(`/auth/users/${userId}`, userData);
    return response.data;
  }

  async updateUserAddress(userId: number, addressId: number, addressData: AddressForm): Promise<ApiResponse<Address>> {
    const response: AxiosResponse<ApiResponse<Address>> = await this.api.put(`/auth/users/${userId}/address/${addressId}`, addressData);
    return response.data;
  }

  async updateAddress(addressId: number, addressData: AddressForm): Promise<ApiResponse<Address>> {
    const response: AxiosResponse<ApiResponse<Address>> = await this.api.put(`/auth/profile/address/${addressId}`, addressData);
    return response.data;
  }

  async deleteAddress(addressId: number): Promise<{ message: string; addresses: Address[] }> {
    const response: AxiosResponse<{ message: string; addresses: Address[] }> = await this.api.delete(`/auth/profile/address/${addressId}`);
    return response.data;
  }

  // Product endpoints
  async getProducts(): Promise<Product[]> {
    const response = await this.api.get('/products');
    const data = response.data || [];
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      description: p.description ?? '',
      isActive: Boolean(p.isActive),
      isFeatured: Boolean(p.isFeatured),
      receiveComplements: Boolean(p.receiveComplements),
      createdAt: p.createdAt || new Date().toISOString(),
      categoryId: p.categoryId ?? null,
      category: p.category ? { id: p.category.id, name: p.category.name } : undefined,
      images: Array.isArray(p.images)
        ? p.images.map((img: any) => ({ id: img.id, url: img.url, altText: img.altText || '' }))
        : [],
      quantidadeComplementos: p.quantidadeComplementos ?? 0,
    }));
  }

  async getProductById(id: number): Promise<Product> {
    const response = await this.api.get(`/products/${id}`);
    const p = response.data;
    return {
      id: p.id,
      name: p.name,
      price: Number(p.price),
      description: p.description ?? '',
      isActive: Boolean(p.isActive),
      isFeatured: Boolean(p.isFeatured),
      quantidadeComplementos: p.quantidadeComplementos ?? 0,
      receiveComplements: Boolean(p.receiveComplements),
      createdAt: p.createdAt || new Date().toISOString(),
      categoryId: p.categoryId ?? null,
      category: p.category ? { id: p.category.id, name: p.category.name } : undefined,
      images: Array.isArray(p.images)
        ? p.images.map((img: any) => ({ id: img.id, url: img.url, altText: img.altText || '' }))
        : [],
    };
  }

  async getProductsByCategory(categoryId: number): Promise<Product[]> {
    const response = await this.api.get(`/products/category/${categoryId}`);
    const data = response.data || [];
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      description: p.description ?? '',
      isActive: Boolean(p.isActive),
      isFeatured: Boolean(p.isFeatured),
      quantidadeComplementos: p.quantidadeComplementos ?? 0,
      receiveComplements: Boolean(p.receiveComplements),
      createdAt: p.createdAt || new Date().toISOString(),
      categoryId: p.categoryId ?? null,
      category: p.category ? { id: p.category.id, name: p.category.name } : undefined,
      images: Array.isArray(p.images)
        ? p.images.map((img: any) => ({ id: img.id, url: img.url, altText: img.altText || '' }))
        : [],
    }));
  }

  async createProduct(formData: FormData): Promise<Product> {
    const response = await this.api.post('/products/add', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  async updateProduct(id: number, formData: FormData): Promise<Product> {
    const response = await this.api.put(`/products/update/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  async deleteProduct(id: number): Promise<ApiResponse<any>> {
    const response: AxiosResponse<ApiResponse<any>> = await this.api.delete(`/products/delete/${id}`);
    return response.data;
  }

  async addCategory(name: string): Promise<ProductCategory> {
    const response: AxiosResponse<ProductCategory> = await this.api.post('/products/categories/add', { nome: name });
    return response.data;
  }

  async updateCategory(id: number, name: string): Promise<ProductCategory> {
    const response: AxiosResponse<ProductCategory> = await this.api.put(`/products/categories/${id}`, { nome: name });
    return response.data;
  }

  async deleteCategory(id: number): Promise<ApiResponse<any>> {
    const response: AxiosResponse<ApiResponse<any>> = await this.api.delete(`/products/categories/${id}`);
    return response.data;
  }

  async getCategories(): Promise<ProductCategory[]> {
    const response: AxiosResponse<ProductCategory[]> = await this.api.get('/products/categories');
    return response.data;
  }

  // Cart endpoints
  async getCart(): Promise<CartResponse> {
    const response: AxiosResponse<CartResponse> = await this.api.get('/cart');
    return response.data;
  }

  async addToCart(productId: number, quantity: number, complementIds?: number[]): Promise<ApiResponse<CartItem>> {
    const response: AxiosResponse<ApiResponse<CartItem>> = await this.api.post('/cart/add', {
      produtoId: productId,
      quantity,
      complementIds: complementIds || [],
    });
    return response.data;
  }

  async addCustomAcaiToCart(customAcai: any, quantity: number): Promise<ApiResponse<CartItem>> {
    const response: AxiosResponse<ApiResponse<CartItem>> = await this.api.post('/cart/add-custom-acai', {
      value: customAcai.value,
      selectedComplements: customAcai.selectedComplements,
      complementNames: customAcai.complementNames,
      quantity,
    });
    return response.data;
  }

  async addCustomProductToCart(productName: string, customProduct: any, quantity: number): Promise<ApiResponse<CartItem>> {
    const response: AxiosResponse<ApiResponse<CartItem>> = await this.api.post('/cart/add-custom-product', {
      productName,
      value: customProduct.value,
      selectedComplements: customProduct.selectedComplements,
      complementNames: customProduct.complementNames,
      quantity,
    });
    return response.data;
  }

  async updateCartItem(cartItemId: number, quantity: number): Promise<ApiResponse<CartItem>> {
    const response: AxiosResponse<ApiResponse<CartItem>> = await this.api.put(`/cart/update/${cartItemId}`, {
      quantity,
    });
    return response.data;
  }

  async removeFromCart(cartItemId: number): Promise<ApiResponse<any>> {
    const response: AxiosResponse<ApiResponse<any>> = await this.api.delete(`/cart/remove/${cartItemId}`);
    return response.data;
  }

  async clearCart(): Promise<ApiResponse<any>> {
    const response: AxiosResponse<ApiResponse<any>> = await this.api.delete('/cart/clear');
    return response.data;
  }

  // Order endpoints
  async createOrder(orderData: { 
    items: CartItem[]; 
    paymentMethod: string; 
    addressId: number | undefined; 
    deliveryType?: string;
    deliveryFee?: number;
    notes?: string;
    precisaTroco?: boolean;
    valorTroco?: number;
  }): Promise<ApiResponse<Order>> {
    const response: AxiosResponse<ApiResponse<Order>> = await this.api.post('/orders', orderData);
    return response.data;
  }

  async createOrderAsAdmin(orderData: {
    userId: number;
    addressId?: number;
    items: Array<{ productId: number; quantity: number; price?: number; complementIds?: number[] }>;
    paymentMethod: string;
    deliveryType?: string;
    deliveryFee?: number;
    notes?: string;
    precisaTroco?: boolean;
    valorTroco?: number;
  }): Promise<ApiResponse<Order>> {
    const response: AxiosResponse<ApiResponse<Order>> = await this.api.post('/orders/admin', orderData);
    return response.data;
  }

  async getOrderHistory(): Promise<Order[]> {
    const response: AxiosResponse<Order[]> = await this.api.get('/orders/history');
    return response.data;
  }

  async cancelOrder(orderId: number): Promise<ApiResponse<Order>> {
    const response: AxiosResponse<ApiResponse<Order>> = await this.api.put(`/orders/cancel/${orderId}`);
    return response.data;
  }

  // Admin order editing methods
  async updateOrderTotal(orderId: number, totalPrice: number): Promise<ApiResponse<Order>> {
    try {
      const response: AxiosResponse<ApiResponse<Order>> = await this.api.put(`/orders/${orderId}/update-total`, { totalPrice });
      return response.data;
    } catch (error: any) {
      console.error('Erro ao atualizar valor do pedido:', error);
      throw error;
    }
  }

  async addItemToOrder(orderId: number, data: { productId: number; quantity: number; complementIds?: number[]; price?: number }): Promise<ApiResponse<Order>> {
    try {
      const response: AxiosResponse<ApiResponse<Order>> = await this.api.post(`/orders/${orderId}/add-item`, data);
      return response.data;
    } catch (error: any) {
      console.error('Erro ao adicionar item ao pedido:', error);
      throw error;
    }
  }

  async removeItemFromOrder(orderId: number, itemId: number): Promise<ApiResponse<Order>> {
    try {
      const response: AxiosResponse<ApiResponse<Order>> = await this.api.delete(`/orders/${orderId}/remove-item/${itemId}`);
      return response.data;
    } catch (error: any) {
      console.error('Erro ao remover item do pedido:', error);
      throw error;
    }
  }

  // Order endpoints - Admin
  async getOrdersAdmin(): Promise<Order[]> {
    const response: AxiosResponse<Order[]> = await this.api.get('/orders/orders');
    return response.data;
  }

  // Order endpoints - User
  async getOrders(): Promise<Order[]> {
    const response: AxiosResponse<Order[]> = await this.api.get('/orders/history');
    return response.data;
  }

async advanceOrderStatus(orderId: number, nextStatus: string, delivererId?: number): Promise<Order> {
  const response = await this.api.put(`/orders/${orderId}`, { 
    status: nextStatus,
    ...(delivererId && { delivererId })
  });
  return response.data;
}

async getPendingOrders() {
  const response = await this.api.get('/orders/pending-count');
  return response.data.count;
}

  async updateOrderStatus(orderId: number, status: string, delivererId?: number): Promise<ApiResponse<Order>> {
    const response: AxiosResponse<ApiResponse<Order>> = await this.api.put(`/orders/${orderId}`, {
      status,
      ...(delivererId && { delivererId }),
    });
    return response.data;
  }

  // Insights endpoints
async getDailySales(date: string) {
  const response = await this.api.get(`/insights/daily-sales/${date}`);
  return response.data;
}

async getProductSales(date: string) {
  const response = await this.api.get(`/insights/product-sales/${date}`);
  return response.data;
}

async getCategorySales(date: string) {
  const response = await this.api.get(`/insights/category-sales/${date}`);
  return response.data;
}

// Store Config endpoints
async getStoreConfig() {
  const response = await this.api.get('/store-config');
  const data = response.data || {};
  // Normalizar campos do backend (aberto/horaAbertura/horaFechamento/diasAbertos)
  return {
    // Chaves esperadas pelo frontend
    isOpen: data.isOpen ?? data.aberto ?? true,
    openingTime: data.openingTime ?? data.horaAbertura ?? '',
    closingTime: data.closingTime ?? data.horaFechamento ?? '',
    openDays: data.openDays ?? data.diasAbertos ?? '',
    // Preservar campos originais para compatibilidade
    ...data,
  };
}

async updateStoreConfig(data: any) {
  const response = await this.api.put('/store-config', data);
  return response.data;
}

// Deliverer methods
async getDeliverers() {
  const response = await this.api.get('/deliverers');
  return response.data;
}

async createDeliverer(data: { name: string; phone: string; email?: string }) {
  const response = await this.api.post('/deliverers', { 
    nome: data.name, 
    telefone: data.phone, 
    email: data.email 
  });
  return response.data;
}

async updateDeliverer(id: number, data: { name: string; phone: string; email?: string; isActive?: boolean }) {
  const response = await this.api.put(`/deliverers/${id}`, { 
    nome: data.name, 
    telefone: data.phone, 
    email: data.email,
    isActive: data.isActive 
  });
  return response.data;
}

async deleteDeliverer(id: number) {
  const response = await this.api.delete(`/deliverers/${id}`);
  return response.data;
}

async toggleDelivererStatus(id: number) {
  const response = await this.api.patch(`/deliverers/${id}/toggle`);
  return response.data;
}

  // ========== COMPLEMENTS METHODS ==========
  async getComplements(includeInactive = false): Promise<any[]> {
    const response = await this.api.get(`/complements${includeInactive ? '?includeInactive=true' : ''}`);
    return response.data;
  }

  async getComplementById(id: number): Promise<any> {
    const response = await this.api.get(`/complements/${id}`);
    return response.data;
  }

  async createComplement(data: { name: string; isActive: boolean; image?: File; categoryId?: number | null }): Promise<any> {
    const formData = new FormData();
    formData.append('nome', data.name);
    formData.append('ativo', String(data.isActive));
    
    if (data.categoryId !== undefined && data.categoryId !== null) {
      formData.append('categoriaId', String(data.categoryId));
    }
    
    if (data.image) {
      formData.append('image', data.image);
    }
    
    const response = await this.api.post('/complements', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async updateComplement(id: number, data: { name?: string; isActive?: boolean; image?: File; categoryId?: number | null }): Promise<any> {
    const formData = new FormData();
    
    if (data.name !== undefined) {
      formData.append('nome', data.name);
    }
    if (data.isActive !== undefined) {
      formData.append('ativo', String(data.isActive));
    }
    if (data.categoryId !== undefined) {
      if (data.categoryId === null) {
        formData.append('categoriaId', '');
      } else {
        formData.append('categoriaId', String(data.categoryId));
      }
    }
    if (data.image) {
      formData.append('image', data.image);
    }
    
    const response = await this.api.put(`/complements/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async deleteComplement(id: number): Promise<any> {
    const response = await this.api.delete(`/complements/${id}`);
    return response.data;
  }

  async toggleComplementStatus(id: number): Promise<any> {
    const response = await this.api.patch(`/complements/${id}/toggle`);
    return response.data;
  }

  // ========== COMPLEMENT CATEGORIES METHODS ==========
  async getComplementCategories(): Promise<any[]> {
    const response = await this.api.get('/complement-categories');
    return response.data;
  }

  async createComplementCategory(name: string): Promise<any> {
    const response = await this.api.post('/complement-categories', { name });
    return response.data;
  }

  async updateComplementCategory(id: number, name: string): Promise<any> {
    const response = await this.api.put(`/complement-categories/${id}`, { name });
    return response.data;
  }

  async deleteComplementCategory(id: number): Promise<any> {
    const response = await this.api.delete(`/complement-categories/${id}`);
    return response.data;
  }

  // ========== DASHBOARD METHODS ==========
  async getDashboardMetrics() {
    const response = await this.api.get('/dashboard/metrics');
    return response.data;
  }

  async getPeriodMetrics(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly', 
    month?: number, 
    year?: number,
    day?: number
  ) {
    let url = `/dashboard/metrics/${period}`;
    if (period === 'monthly' && month !== undefined && year !== undefined) {
      url += `?month=${month}&year=${year}`;
    } else if (period === 'daily' && day !== undefined && month !== undefined && year !== undefined) {
      url += `?day=${day}&month=${month}&year=${year}`;
    } else if (period === 'yearly' && year !== undefined) {
      url += `?year=${year}`;
    }
    const response = await this.api.get(url);
    return response.data;
  }

  async getTopProducts(
    period: 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly' = 'all',
    month?: number,
    year?: number,
    day?: number
  ) {
    let url = '/dashboard/top-products';
    
    // Se period for 'all', não adiciona o parâmetro na URL
    if (period !== 'all') {
      url += `/${period}`;
      
      // Adicionar query parameters para períodos específicos
      if (period === 'monthly' && month !== undefined && year !== undefined) {
        url += `?month=${month}&year=${year}`;
      } else if (period === 'daily' && day !== undefined && month !== undefined && year !== undefined) {
        url += `?day=${day}&month=${month}&year=${year}`;
      } else if (period === 'yearly' && year !== undefined) {
        url += `?year=${year}`;
      }
    }
    
    const response = await this.api.get(url);
    return response.data;
  }

  async getSalesHistory() {
    const response = await this.api.get('/dashboard/sales-history');
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
