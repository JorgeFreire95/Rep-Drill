export interface StockValidationItem {
  product_id: number;
  name: string;
  sku: string;
  requested_quantity: number;
  available_quantity: number;
  status: 'in_stock' | 'partial' | 'out_of_stock' | 'not_found';
  price: number;
  cost_price: number;
  profit_margin?: number;
  is_low_stock: boolean;
  needs_reorder: boolean;
  reorder_quantity: number;
  min_stock: number;
  warnings: string[];
}

export interface StockValidationResult {
  all_available: boolean;
  validation_timestamp: string;
  items: StockValidationItem[];
  warnings: string[];
  summary: {
    total_items: number;
    available: number;
    partial: number;
    unavailable: number;
  };
}
