import { ISqlExecutor } from '../contracts';
import { Migration } from './types';

export const migration001: Migration = {
  version: 1,
  name: '001_initial_schema',
  async up(executor: ISqlExecutor): Promise<void> {
    // 1. Roles Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

    // 2. Permissions Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        module TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT
      );
    `);

    // 3. Role Permissions Join Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );
    `);

    // 4. Users Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role_id TEXT NOT NULL REFERENCES roles(id),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 5. Categories Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 6. Products Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL REFERENCES categories(id),
        name TEXT NOT NULL,
        barcode TEXT UNIQUE,
        price INTEGER NOT NULL,
        cost_price INTEGER NOT NULL DEFAULT 0,
        track_stock INTEGER NOT NULL DEFAULT 0,
        current_stock INTEGER NOT NULL DEFAULT 0,
        min_stock_alert INTEGER NOT NULL DEFAULT 0,
        unit TEXT NOT NULL DEFAULT 'piece',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 7. Customers Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 8. Cash Shifts Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS cash_shifts (
        id TEXT PRIMARY KEY,
        shift_number TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id),
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        opening_cash INTEGER NOT NULL,
        expected_cash INTEGER NOT NULL DEFAULT 0,
        actual_cash INTEGER,
        cash_difference INTEGER,
        status TEXT NOT NULL CHECK(status IN ('OPEN', 'CLOSED')),
        notes TEXT
      );
    `);

    // 9. Orders Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number TEXT UNIQUE NOT NULL,
        order_type TEXT NOT NULL CHECK(order_type IN ('DINE_IN', 'TAKEAWAY', 'DELIVERY')),
        status TEXT NOT NULL CHECK(status IN ('HOLD', 'PENDING', 'COMPLETED', 'CANCELLED', 'RETURNED')),
        customer_id TEXT REFERENCES customers(id),
        table_number TEXT,
        shift_id TEXT NOT NULL REFERENCES cash_shifts(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        notes TEXT,
        subtotal INTEGER NOT NULL,
        discount_type TEXT CHECK(discount_type IN ('PERCENTAGE', 'FIXED', NULL)),
        discount_value INTEGER NOT NULL DEFAULT 0,
        discount_amount INTEGER NOT NULL DEFAULT 0,
        tax_rate REAL NOT NULL DEFAULT 0,
        tax_amount INTEGER NOT NULL DEFAULT 0,
        delivery_fee INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 10. Order Items Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id TEXT REFERENCES products(id),
        product_name_snapshot TEXT NOT NULL,
        unit_price INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal INTEGER NOT NULL,
        discount_amount INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
      );
    `);

    // 11. Payments Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        shift_id TEXT NOT NULL REFERENCES cash_shifts(id),
        payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'CARD', 'SPLIT')),
        amount INTEGER NOT NULL,
        tender_amount INTEGER NOT NULL,
        change_amount INTEGER NOT NULL DEFAULT 0,
        reference_number TEXT,
        created_at TEXT NOT NULL
      );
    `);

    // 12. Invoices Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT UNIQUE NOT NULL,
        order_id TEXT NOT NULL REFERENCES orders(id),
        shift_id TEXT NOT NULL REFERENCES cash_shifts(id),
        status TEXT NOT NULL CHECK(status IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')),
        total_amount INTEGER NOT NULL,
        tax_amount INTEGER NOT NULL,
        discount_amount INTEGER NOT NULL,
        net_amount INTEGER NOT NULL,
        customer_name_snapshot TEXT,
        cashier_name_snapshot TEXT NOT NULL,
        printed_count INTEGER NOT NULL DEFAULT 0,
        last_printed_at TEXT,
        created_at TEXT NOT NULL
      );
    `);

    // 13. Cash Transactions Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS cash_transactions (
        id TEXT PRIMARY KEY,
        shift_id TEXT NOT NULL REFERENCES cash_shifts(id),
        transaction_type TEXT NOT NULL CHECK(transaction_type IN ('CASH_IN', 'CASH_OUT', 'SALE_PAYMENT', 'REFUND', 'EXPENSE')),
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        reference_id TEXT,
        user_id TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL
      );
    `);

    // 14. Expenses Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        shift_id TEXT REFERENCES cash_shifts(id),
        category TEXT NOT NULL,
        amount INTEGER NOT NULL,
        description TEXT NOT NULL,
        paid_from_cash_drawer INTEGER NOT NULL DEFAULT 1,
        user_id TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL
      );
    `);

    // 15. Inventory Movements Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id),
        movement_type TEXT NOT NULL CHECK(movement_type IN ('IN', 'OUT', 'SALE', 'RETURN', 'DAMAGE', 'ADJUSTMENT')),
        quantity INTEGER NOT NULL,
        reference_type TEXT NOT NULL CHECK(reference_type IN ('ORDER', 'RETURN', 'MANUAL', 'PURCHASE')),
        reference_id TEXT,
        notes TEXT,
        user_id TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL
      );
    `);

    // 16. Returns Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS returns (
        id TEXT PRIMARY KEY,
        return_number TEXT UNIQUE NOT NULL,
        original_order_id TEXT NOT NULL REFERENCES orders(id),
        shift_id TEXT NOT NULL REFERENCES cash_shifts(id),
        refund_method TEXT NOT NULL CHECK(refund_method IN ('CASH', 'CARD')),
        total_refund_amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL
      );
    `);

    // 17. Return Items Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS return_items (
        id TEXT PRIMARY KEY,
        return_id TEXT NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id),
        product_name_snapshot TEXT NOT NULL,
        unit_price INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        total INTEGER NOT NULL,
        restock INTEGER NOT NULL DEFAULT 1
      );
    `);

    // 18. Settings Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TEXT NOT NULL
      );
    `);

    // 19. Printers Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS printers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        printer_type TEXT NOT NULL CHECK(printer_type IN ('RECEIPT', 'KITCHEN')),
        connection_type TEXT NOT NULL CHECK(connection_type IN ('USB', 'NETWORK', 'SERIAL')),
        address TEXT,
        paper_width INTEGER NOT NULL DEFAULT 80,
        is_default INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1
      );
    `);

    // 20. Backups Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        backup_type TEXT NOT NULL CHECK(backup_type IN ('MANUAL', 'AUTO_SHIFT_CLOSE', 'AUTO_DAILY')),
        status TEXT NOT NULL CHECK(status IN ('CREATED', 'RESTORED', 'FAILED')),
        created_at TEXT NOT NULL
      );
    `);

    // 21. Audit Logs Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        details_json TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL
      );
    `);

    // 22. Indexes for Performance & Constraints
    await executor.execute(`
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_payments_shift ON payments(shift_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_shift ON invoices(shift_id);
      CREATE INDEX IF NOT EXISTS idx_cash_shifts_user ON cash_shifts(user_id);
      CREATE INDEX IF NOT EXISTS idx_cash_shifts_status ON cash_shifts(status);
      CREATE INDEX IF NOT EXISTS idx_cash_tx_shift ON cash_transactions(shift_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_shift ON expenses(shift_id);
      CREATE INDEX IF NOT EXISTS idx_inv_movements_product ON inventory_movements(product_id);
      CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(original_order_id);
      CREATE INDEX IF NOT EXISTS idx_returns_shift ON returns(shift_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    `);
  },
};
