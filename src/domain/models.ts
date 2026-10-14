import {
  OrderType,
  OrderStatus,
  PaymentMethod,
  InvoiceStatus,
  ShiftStatus,
  CashTransactionType,
  InventoryMovementType,
} from './enums';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role_id: string;
  role_name?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  product_count?: number;
}

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  category_id: string;
  category_name?: string;
  selling_price: number; // minor units (e.g. 8500 = 85.00 EGP)
  cost_price: number;    // minor units
  unit: string;
  stock_quantity: number;
  minimum_stock: number;
  tax_rate: number;      // basis points (e.g. 1400 = 14%)
  track_inventory: number; // 0 or 1
  is_active: number;     // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  orders_count?: number;
  total_spent?: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name_snapshot: string;
  unit_price: number;      // minor units
  quantity: number;
  discount_amount: number; // minor units
  tax_amount: number;      // minor units
  total_amount: number;    // minor units
  notes: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  order_type: OrderType;
  status: OrderStatus;
  table_number: string | null;
  customer_id: string | null;
  customer_name?: string;
  cashier_id: string;
  cashier_name?: string;
  shift_id: string | null;
  subtotal: number;        // minor units
  discount_amount: number; // minor units
  tax_amount: number;      // minor units
  delivery_fee: number;    // minor units
  total_amount: number;    // minor units
  notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  items?: OrderItem[];
}

export interface Payment {
  id: string;
  order_id: string;
  payment_method: PaymentMethod;
  amount: number;          // minor units
  cash_received?: number;  // minor units (for Cash change calculation)
  change?: number;         // minor units
  reference_number: string | null;
  received_by: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  order_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issued_at: string;
  created_at: string;
}

export interface CashShift {
  id: string;
  user_id: string;
  user_name?: string;
  opening_cash: number;    // minor units
  expected_cash: number;   // minor units
  actual_cash: number | null; // minor units
  difference: number | null;  // minor units
  status: ShiftStatus;
  opened_at: string;
  closed_at: string | null;
  closing_notes: string | null;
}

export interface CashTransaction {
  id: string;
  shift_id: string;
  type: CashTransactionType;
  amount: number;          // minor units
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  user_id: string;
  created_at: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;          // minor units
  payment_method: PaymentMethod;
  description: string | null;
  user_id: string;
  shift_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  product_name?: string;
  movement_type: InventoryMovementType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  reason: string | null;
  user_id: string;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  value_type: 'STRING' | 'INTEGER' | 'BOOLEAN' | 'JSON';
  updated_at: string;
}

export interface Printer {
  id: string;
  name: string;
  type: 'RECEIPT' | 'KITCHEN';
  connection_type: 'USB' | 'NETWORK' | 'SYSTEM';
  address: string | null;
  paper_width: number;
  is_default: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Backup {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  created_by: string;
  created_at: string;
  backup_type: 'MANUAL' | 'AUTOMATIC' | 'PRE_RESTORE';
  status: 'CREATED' | 'FAILED' | 'RESTORED';
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_name?: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_value: string | null;
  new_value: string | null;
  device_id: string | null;
  created_at: string;
}
