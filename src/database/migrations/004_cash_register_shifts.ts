import { ISqlExecutor } from '../contracts';
import { Migration } from './types';

export const migration004: Migration = {
  version: 4,
  name: '004_cash_register_shifts',
  async up(executor: ISqlExecutor): Promise<void> {
    const now = new Date().toISOString();

    // 1. Upgrade cash_transactions table to support all standard financial transaction types
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS cash_transactions_new (
        id TEXT PRIMARY KEY,
        shift_id TEXT NOT NULL REFERENCES cash_shifts(id),
        transaction_type TEXT NOT NULL CHECK(transaction_type IN (
          'CASH_IN', 'CASH_OUT', 'SALE_PAYMENT', 'SALE', 'REFUND',
          'EXPENSE', 'DEPOSIT', 'WITHDRAWAL', 'OPENING', 'CLOSING', 'ADJUSTMENT'
        )),
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        reference_id TEXT,
        user_id TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL
      );
    `);

    // Copy all existing transactions safely
    await executor.execute(`
      INSERT INTO cash_transactions_new (id, shift_id, transaction_type, amount, reason, reference_id, user_id, created_at)
      SELECT id, shift_id, transaction_type, amount, reason, reference_id, user_id, created_at
      FROM cash_transactions;
    `);

    await executor.execute('DROP TABLE cash_transactions;');
    await executor.execute('ALTER TABLE cash_transactions_new RENAME TO cash_transactions;');

    // Re-create index
    await executor.execute(`
      CREATE INDEX IF NOT EXISTS idx_cash_tx_shift ON cash_transactions(shift_id);
      CREATE INDEX IF NOT EXISTS idx_cash_tx_type ON cash_transactions(transaction_type);
      CREATE INDEX IF NOT EXISTS idx_cash_tx_user ON cash_transactions(user_id);
    `);

    // 2. Register new and alias permissions for cash and shifts
    const newPermissions = [
      { id: 'perm-shifts-view', code: 'shifts.view', module: 'shifts', name: 'عرض ورديات الكاشير' },
      { id: 'perm-cash-view-alias', code: 'cash.view', module: 'cash', name: 'عرض رصيد وحركات الخزينة' },
      { id: 'perm-cash-adjust', code: 'cash.adjust', module: 'cash', name: 'تسوية فروقات الخزينة والدرج' },
    ];

    for (const perm of newPermissions) {
      await executor.execute(
        `INSERT OR IGNORE INTO permissions (id, code, module, name, description) VALUES (?, ?, ?, ?, ?);`,
        [perm.id, perm.code, perm.module, perm.name, perm.name]
      );
    }

    // Assign permissions to roles if roles exist
    const existingRoles = await executor.query<{ id: string }>('SELECT id FROM roles WHERE id IN (?, ?, ?);', [
      'role-admin',
      'role-manager',
      'role-cashier',
    ]);
    const roleIdSet = new Set(existingRoles.map((r) => r.id));

    // Admin gets all
    if (roleIdSet.has('role-admin')) {
      for (const perm of newPermissions) {
        await executor.execute(
          `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?);`,
          ['role-admin', perm.id]
        );
      }
    }

    // Manager gets shifts.view, cash.view, cash.adjust
    if (roleIdSet.has('role-manager')) {
      for (const perm of newPermissions) {
        await executor.execute(
          `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?);`,
          ['role-manager', perm.id]
        );
      }
    }

    // Cashier gets shifts.view and cash.view
    if (roleIdSet.has('role-cashier')) {
      for (const permId of ['perm-shifts-view', 'perm-cash-view-alias']) {
        await executor.execute(
          `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?);`,
          ['role-cashier', permId]
        );
      }
    }
  },
};
