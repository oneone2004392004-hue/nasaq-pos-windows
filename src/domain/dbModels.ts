/**
 * Exact SQLite Database Entity Models
 * Matches the SQLite table schemas created in migration 001.
 */

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  role_id: string;
  is_active: number;
  failed_login_attempts?: number;
  locked_until?: string | null;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: number;
  created_at: string;
}

export interface PermissionRow {
  id: string;
  code: string;
  module: string;
  name: string;
  description: string | null;
}

export interface RolePermissionRow {
  role_id: string;
  permission_id: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ProductRow {
  id: string;
  category_id: string;
  name: string;
  barcode: string | null;
  price: number; // minor units (e.g. 8500 = 85.00 EGP)
  cost_price: number; // minor units
  track_stock: number;
  current_stock: number;
  min_stock_alert: number;
  unit: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active?: number;
  created_at: string;
  updated_at: string;
}

export interface CashShiftRow {
  id: string;
  shift_number: string;
  user_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number; // minor units
  expected_cash: number; // minor units
  actual_cash: number | null; // minor units
  cash_difference: number | null; // minor units
  status: 'OPEN' | 'CLOSED';
  notes: string | null;
}

export interface TableRow {
  id: string;
  name: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DeliveryDriverRow {
  id: string;
  name: string;
  phone: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface OrderRow {
  id: string;
  order_number: string;
  order_type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  status: 'HOLD' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'RETURNED';
  customer_id: string | null;
  table_id?: string | null;
  table_number: string | null;
  delivery_driver_id?: string | null;
  delivery_status?: 'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | null;
  shift_id: string;
  user_id: string;
  notes: string | null;
  subtotal: number; // minor units
  discount_type: 'PERCENTAGE' | 'FIXED' | null;
  discount_value: number;
  discount_amount: number; // minor units
  tax_rate: number;
  tax_amount: number; // minor units
  delivery_fee: number; // minor units
  total: number; // minor units
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name_snapshot: string;
  unit_price: number; // minor units
  quantity: number;
  subtotal: number; // minor units
  discount_amount: number; // minor units
  total: number; // minor units
  notes: string | null;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  order_id: string;
  shift_id: string;
  payment_method: 'CASH' | 'CARD' | 'SPLIT';
  amount: number; // minor units
  tender_amount: number; // minor units
  change_amount: number; // minor units
  reference_number: string | null;
  created_at: string;
}

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  order_id: string;
  shift_id: string;
  status: 'PAID' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  total_amount: number; // minor units
  tax_amount: number; // minor units
  discount_amount: number; // minor units
  net_amount: number; // minor units
  customer_name_snapshot: string | null;
  cashier_name_snapshot: string;
  printed_count: number;
  last_printed_at: string | null;
  created_at: string;
}

export interface CashTransactionRow {
  id: string;
  shift_id: string;
  transaction_type:
    | 'CASH_IN'
    | 'CASH_OUT'
    | 'SALE_PAYMENT'
    | 'SALE'
    | 'REFUND'
    | 'EXPENSE'
    | 'DEPOSIT'
    | 'WITHDRAWAL'
    | 'OPENING'
    | 'CLOSING'
    | 'ADJUSTMENT';
  amount: number; // minor units
  reason: string;
  reference_id: string | null;
  user_id: string;
  created_at: string;
}

export interface ExpenseRow {
  id: string;
  shift_id: string | null;
  category: string;
  amount: number; // minor units
  description: string;
  paid_from_cash_drawer: number;
  user_id: string;
  created_at: string;
}

export interface InventoryMovementRow {
  id: string;
  product_id: string;
  movement_type: 'IN' | 'OUT' | 'SALE' | 'RETURN' | 'DAMAGE' | 'ADJUSTMENT';
  quantity: number;
  reference_type: 'ORDER' | 'RETURN' | 'MANUAL' | 'PURCHASE';
  reference_id: string | null;
  notes: string | null;
  user_id: string;
  created_at: string;
}

export interface ReturnRow {
  id: string;
  return_number: string;
  original_order_id: string;
  shift_id: string;
  original_shift_id?: string | null;
  refund_method: 'CASH' | 'CARD';
  total_refund_amount: number; // minor units
  reason: string;
  user_id: string;
  created_at: string;
}

export interface ReturnItemRow {
  id: string;
  return_id: string;
  order_item_id?: string | null;
  product_id: string;
  product_name_snapshot: string;
  unit_price: number; // minor units
  quantity: number;
  total: number; // minor units
  restock: number;
}

export interface SettingRow {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

export interface PrinterRow {
  id: string;
  name: string;
  printer_type: 'RECEIPT' | 'KITCHEN';
  connection_type: 'USB' | 'NETWORK' | 'SERIAL';
  address: string | null;
  paper_width: number;
  code_page?: 'CP864' | 'WPC1256';
  print_mode?: 'RAW' | 'RASTER';
  is_default: number;
  is_active: number;
}

export interface BackupRow {
  id: string;
  filename: string;
  filepath: string;
  size_bytes: number;
  backup_type: 'MANUAL' | 'AUTO_SHIFT_CLOSE' | 'AUTO_DAILY';
  status: 'CREATED' | 'RESTORED' | 'FAILED';
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details_json: string | null;
  ip_address: string | null;
  created_at: string;
}
