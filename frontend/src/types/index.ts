// ==================== AUTH ====================
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff?: boolean;
  is_active?: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

// ==================== PERSONAS ====================
export interface Persona {
  id: number;
  nombre: string;
  tipo_documento: string;
  numero_documento: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  es_cliente: boolean;
  es_proveedor: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
}

export interface PersonaFormData {
  nombre: string;
  tipo_documento: string;
  numero_documento: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  es_cliente: boolean;
  es_proveedor: boolean;
}

// ==================== INVENTARIO ====================
export interface Warehouse {
  id: number;
  name: string;
  location: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

export interface WarehouseFormData {
  name: string;
  location: string;
  description: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryFormData {
  name: string;
  description: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  sku: string;
  category: number | null;
  category_name?: string;
  supplier: number | null;
  supplier_name?: string;
  warehouse: number | null;
  warehouse_name?: string;
  cost_price: number;
  price: number;
  unit_of_measure: string;
  quantity: number;
  min_stock: number;
  reorder_quantity: number;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  profit_margin?: number;
  is_low_stock?: boolean;
  needs_reorder?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductFormData {
  name: string;
  description: string;
  sku: string;
  category: number | null;
  supplier: number | null;
  warehouse: number | null;
  cost_price: number;
  price: number;
  unit_of_measure: string;
  quantity: number;
  min_stock: number;
  reorder_quantity: number;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
}

export interface ProductPriceHistory {
  id: number;
  product: number;
  product_name?: string;
  price: string;
  start_date: string;
  end_date?: string;
}

// Stock Alerts
export interface ProductWithAlert extends Product {
  alert_level: 'critical' | 'high' | 'medium' | 'low';
  alert_message: string;
  needs_reorder: boolean;
  stock_percentage: number;
  missing_to_min: number;
  recommended_reorder: number;
}

export interface AlertsByLevel {
  critical: ProductWithAlert[];
  high: ProductWithAlert[];
  medium: ProductWithAlert[];
}

export interface LowStockResponse {
  count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  threshold_multiplier: number;
  results: ProductWithAlert[];
  alerts_by_level: AlertsByLevel;
}

export interface LowStockCountResponse {
  count: number;
  critical: number;
  high: number;
  medium: number;
  threshold_multiplier: number;
  has_critical: boolean;
  has_alerts: boolean;
}

export interface Inventory {
  id: number;
  product: number;
  product_name?: string;
  warehouse: number;
  warehouse_name?: string;
  quantity: number;
  entry_date: string;
  exit_date?: string;
}

export interface InventoryEvent {
  id: number;
  inventory: number;
  choice: string;
  quantity: number;
  event_date: string;
  notes?: string;
}

// ==================== STOCK RESERVATIONS ====================
export type ReservationStatus = 'pending' | 'confirmed' | 'released' | 'expired';

export interface StockReservation {
  id: number;
  product: number;
  product_name?: string;
  quantity: number;
  order_id: string | null;
  status: ReservationStatus;
  reserved_at: string;
  expires_at: string | null;
  confirmed_at: string | null;
  released_at: string | null;
}

export interface ReservationSummary {
  active_count: number;
  total_reserved_quantity: number;
  expiring_soon: number;
  reservations: StockReservation[];
}

// ==================== REORDERS ====================
export type ReorderStatus = 'requested' | 'ordered' | 'received' | 'cancelled';

export interface ReorderRequest {
  id: number;
  product: number;
  product_name?: string;
  supplier?: number | null;
  supplier_name?: string | null;
  quantity: number;
  status: ReorderStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReorderStatusHistory {
  id: number;
  reorder: number;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
}

// ==================== FORECAST ACCURACY ====================
export interface ForecastProductAccuracy {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  start_date: string;
  end_date: string;
  mape: number;  // Mean Absolute Percentage Error
  mae: number;   // Mean Absolute Error
  record_count: number;
  created_at: string;
}

export interface ForecastCategoryAccuracy {
  id: number;
  category_id: number;
  category_name: string;
  start_date: string;
  end_date: string;
  mape: number;
  mae: number;
  record_count: number;
  product_count: number;
  created_at: string;
}

// ==================== VENTAS ====================
export interface Order {
  id: number;
  customer_id: number;
  customer_name?: string;
  employee_id?: number | null;
  order_date: string;
  warehouse_id?: number | null;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
  total: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  details?: OrderDetail[];  // Para escritura
  details_read?: OrderDetail[];  // Para lectura desde el backend
}

export interface OrderFormData {
  customer_id: number;
  employee_id?: number | null;
  warehouse_id?: number | null;
  status?: string;
  notes?: string;
  details: OrderDetailFormData[];
}

export interface OrderDetail {
  id?: number;
  order: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
  detail_date?: string;
}

export interface OrderDetailFormData {
  product_id: number;
  quantity: number;
  unit_price: number;
  discount?: number;
}

export interface Shipment {
  id: number;
  order: number;
  shipment_date: string;
  delivery_date?: string | null;
  warehouse_id?: number | null;
  warehouse_name?: string;
  delivered?: boolean;
  delivery_status?: string;
}

export interface ShipmentFormData {
  order: number;
  shipment_date: string;
  warehouse_id?: number | null;
  delivered?: boolean;
  delivery_status?: string;
}

export interface Payment {
  id: number;
  order: number;
  amount: string;
  payment_date: string;
  payment_method: string;
}

export interface PaymentFormData {
  order: number;
  amount: string;
  payment_method: string;
}

// ==================== PREDICCIONES ====================
export interface PrediccionConfig {
  producto_id: number;
  periodos: number;
  intervalo_confianza: number;
  estacionalidad?: 'auto' | 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export interface PrediccionResultado {
  fecha: string;
  valor_predicho: number;
  limite_inferior: number;
  limite_superior: number;
  tendencia?: number;
  estacionalidad?: number;
}

export interface PrediccionResponse {
  producto: Product;
  configuracion: PrediccionConfig;
  predicciones: PrediccionResultado[];
  metricas: {
    mape?: number;
    rmse?: number;
    mae?: number;
  };
  fecha_generacion: string;
}

// ==================== DASHBOARD ====================
export interface DashboardStats {
  ventas_hoy: string;
  ventas_mes: string;
  productos_bajo_stock: number;
  total_clientes: number;
  total_productos: number;
}

export interface VentasPorPeriodo {
  periodo: string;
  total: number;
}

export interface ProductoMasVendido {
  producto_id: number;
  producto_nombre: string;
  cantidad_vendida: number;
  total_vendido: string;
}

// ==================== API RESPONSE ====================
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  status?: number;
}
