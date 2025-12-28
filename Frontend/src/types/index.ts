// User related types
export interface User {
  role: string;
  id: number;
  nomeUsuario: string;
  email?: string;
  telefone: string;
  funcao: 'user' | 'admin' | 'master';
  enderecos?: Address[];
  order?: {
    id: number;
    totalPrice: number;
    status: string;
    createdAt: string;
  }[];
}

export interface Address {
  id: number;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  reference?: string;
  isDefault: boolean;
  userId: number;
}

// Product related types
export interface Product {
  id: number;
  name: string;
  price: number;
  description?: string;
  isActive: boolean;
  isFeatured?: boolean;
  receiveComplements?: boolean;
  quantidadeComplementos?: number;
  createdAt: string;
  images?: ProductImage[];
  options?: ProductOption[];
  categoryId?: number;
  category?: ProductCategory;
}

export interface ProductImage {
  id: number;
  url: string;
  altText?: string;
  productId: number;
}

export interface ProductCategory {
  id: number;
  name: string;
  products?: Product[];
}

export interface ProductOption {
  id: number;
  name: string;
  productId: number;
  values: OptionValue[];
}

export interface OptionValue {
  id: number;
  value: string;
  priceModifier: number;
  optionId: number;
}

// Cart related types
export interface Cart {
  id: number;
  createdAt: string;
  userId: number;
  items: CartItem[];
}

export interface CartItem {
  id: number;
  quantity: number;
  createdAt: string;
  cartId: number;
  productId: number;
  product: Product;
  selectedOptions?: any;
  complements?: Complement[];
  totalPrice?: number;
}

// Order related types
export interface Order {
  id: number;
  totalPrice: number;
  status: OrderStatus;
  deliveryType?: string;
  deliveryFee?: number;
  paymentMethod?: string;
  createdAt: string;
  userId: number;
  shippingStreet: string;
  shippingNumber: string;
  shippingComplement?: string;
  shippingNeighborhood: string;
  shippingPhone?: string;
  notes?: string;
  precisaTroco?: boolean;
  valorTroco?: number | null;
  orderitem: OrderItem[];
  payment?: Payment;
  user?: {
    username?: string;
    // other user properties...
  };
}

export interface OrderItem {
  id: number;
  quantity: number;
  priceAtOrder: number;
  orderId: number;
  productId: number;
  product: Product;
  selectedOptionsSnapshot?: any;
  complements?: Complement[];
}

export interface Payment {
  id: number;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
  orderId: number;
}

export interface Coupon {
  id: number;
  code: string;
  discountType: DiscountType;
  value: number;
  expiresAt?: string;
  isActive: boolean;
  maxUses?: number;
  usedCount: number;
}

export interface OrderCoupon {
  id: number;
  orderId: number;
  couponId: number;
  discountAmount: number;
  coupon: Coupon;
}

// Review types
export interface Review {
  id: number;
  rating: number;
  comment?: string;
  createdAt: string;
  userId: number;
  productId: number;
  user: User;
}

// Enums
export type Funcao = 'user' | 'admin' | 'master';
export type OrderStatus = 'pending_payment' | 'being_prepared' | 'ready_for_pickup' | 'on_the_way' | 'delivered' | 'canceled';
export type PaymentMethod = 'CREDIT_CARD' | 'PIX' | 'CASH_ON_DELIVERY';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

// API Response types
export interface ApiResponse<T> {
  message: string;
  data?: T;
  error?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface CartResponse {
  items: CartItem[];
  cartTotal: number;
}

// Form types
export interface LoginForm {
  telefone: string;
  password: string;
}

export interface RegisterForm {
  username: string;
  telefone: string;
  password: string;
}

export interface AddressForm {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  reference?: string;
  isDefault?: boolean;
}

export interface ProductForm {
  name: string;
  price: number;
  description?: string;
  categoryId?: number;
}

// Context types
export interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  token: string | null;
  login: (telefone: string, password: string) => Promise<void>;
  register: (username: string, telefone: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  refreshUserProfile: () => Promise<void>;
}

export interface CartContextType {
  items: CartItem[];
  total: number;
  addItem: (productId: number, quantity: number, complementIds?: number[]) => Promise<void>;
  addCustomAcai: (customAcai: CustomAcai, quantity: number) => Promise<void>;
  addCustomProduct: (productName: string, selectedOptions: any, quantity: number) => Promise<void>;
  updateItem: (cartItemId: number, quantity: number) => Promise<void>;
  removeItem: (cartItemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  loading: boolean;
}

// Deliverer related types
export interface Deliverer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  isActive: boolean;
  totalDeliveries: number;
  createdAt: string;
}

// Dashboard related types
export interface DailyMetrics {
  revenue: number;
  sales: number;
  ticketAverage: number;
  revenueChange: number;
  ordersChange: number;
}

export interface WeeklyData {
  day: string;
  revenue: number;
  orders: number;
  date: string;
}

export interface WeeklyMetrics {
  revenue: number;
  data: WeeklyData[];
}

export interface TopProduct {
  id: number;
  name: string;
  price: number;
  quantitySold: number;
  orderCount: number;
}

export interface OrderStatusCount {
  status: string;
  count: number;
}

export interface DashboardMetrics {
  daily: DailyMetrics;
  weekly: WeeklyMetrics;
  topProducts: TopProduct[];
  pendingOrders: number;
  todayOrdersStatus: OrderStatusCount[];
}

export interface SalesHistory {
  date: string;
  revenue: number;
  orders: number;
}

// Complement types (açaí complements without individual pricing)
export interface Complement {
  id: number;
  name: string;
  imageUrl?: string;
  isActive: boolean;
  categoryId?: number | null;
  category?: ComplementCategory | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComplementCategory {
  id: number;
  name: string;
  complementsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Custom Açaí types (customer chooses value and complements)
export interface CustomAcai {
  id?: number;
  value: number; // Valor escolhido pelo cliente (ex: R$ 20.00)
  selectedComplements: number[]; // IDs dos complementos selecionados
  complementNames?: string[]; // Nomes dos complementos (para exibição)
}

export interface CustomAcaiCartItem {
  id: number;
  quantity: number;
  customAcai: CustomAcai;
  totalPrice: number; // = customAcai.value * quantity
}
