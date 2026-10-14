import { ISqlExecutor } from '../contracts';

/**
 * Isolated test seed data.
 * Used strictly in testing / demo test harnesses and NEVER mixed into production initialization.
 */
export async function runTestSeed(executor: ISqlExecutor): Promise<{
  adminUserId: string;
  cashierUserId: string;
  categoryId: string;
  productId: string;
  customerId: string;
  shiftId: string;
}> {
  return await executor.transaction(async (tx) => {
    const now = new Date().toISOString();

    const adminUserId = 'user-test-admin';
    const cashierUserId = 'user-test-cashier';
    const categoryId = 'cat-test-burgers';
    const productId = 'prod-test-burger-double';
    const customerId = 'cust-test-ahmed';
    const shiftId = 'shift-test-100';

    // Users
    await tx.execute(
      `INSERT OR REPLACE INTO users (id, username, password_hash, name, role_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [adminUserId, 'admin_test', 'hash_test_secret_123', 'المدير التجريبي', 'role-admin', 1, now, now]
    );

    await tx.execute(
      `INSERT OR REPLACE INTO users (id, username, password_hash, name, role_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [cashierUserId, 'cashier_test', 'hash_test_secret_456', 'كاشير تجريبي', 'role-cashier', 1, now, now]
    );

    // Category
    await tx.execute(
      `INSERT OR REPLACE INTO categories (id, name, sort_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [categoryId, 'ساندوتشات تجريبية', 1, 1, now, now]
    );

    // Product (Price = 8500 minor units = 85.00 EGP)
    await tx.execute(
      `INSERT OR REPLACE INTO products (id, category_id, name, barcode, price, cost_price, track_stock, current_stock, min_stock_alert, unit, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [productId, categoryId, 'برجر لحم دوبل', '62210001', 8500, 4500, 1, 25, 5, 'piece', 1, now, now]
    );

    // Customer
    await tx.execute(
      `INSERT OR REPLACE INTO customers (id, name, phone, address, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [customerId, 'أحمد محمود التجريبي', '01012345678', 'شارع مصدق - الدقي', 'عميل تجريبي للاختبارات', now, now]
    );

    // Open Shift (Opening cash = 50000 minor units = 500.00 EGP)
    await tx.execute(
      `INSERT OR REPLACE INTO cash_shifts (id, shift_number, user_id, opened_at, opening_cash, expected_cash, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [shiftId, 'SHIFT-TEST-100', cashierUserId, now, 50000, 50000, 'OPEN', 'وردية اختبار آلية']
    );

    return { adminUserId, cashierUserId, categoryId, productId, customerId, shiftId };
  });
}
