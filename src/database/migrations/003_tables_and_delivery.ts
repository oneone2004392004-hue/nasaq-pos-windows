import { ISqlExecutor } from '../contracts';
import { Migration } from './types';

export const migration003: Migration = {
  version: 3,
  name: '003_tables_and_delivery',
  async up(executor: ISqlExecutor): Promise<void> {
    const now = new Date().toISOString();
    // 1. Restaurant Dining Tables Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS tables (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        capacity INTEGER NOT NULL DEFAULT 4,
        status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 2. Delivery Drivers Table
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS delivery_drivers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 3. Add Columns to Orders for Table FK, Delivery Driver FK, and Operational Delivery Status
    await executor.execute(`
      ALTER TABLE orders ADD COLUMN table_id TEXT REFERENCES tables(id);
    `);

    await executor.execute(`
      ALTER TABLE orders ADD COLUMN delivery_driver_id TEXT REFERENCES delivery_drivers(id);
    `);

    await executor.execute(`
      ALTER TABLE orders ADD COLUMN delivery_status TEXT DEFAULT NULL CHECK(delivery_status IN ('PENDING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', NULL));
    `);

    // 4. Performance & Query Indexes
    await executor.execute(`
      CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status);
      CREATE INDEX IF NOT EXISTS idx_tables_active ON tables(is_active);
      CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
      CREATE INDEX IF NOT EXISTS idx_orders_delivery_driver ON orders(delivery_driver_id);
      CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status);
    `);

    // 5. Seed New Permissions for Phase 8 in permissions table
    const newPermissions = [
      // Tables permissions
      { id: 'perm-tables-view', code: 'tables.view', module: 'tables', name: 'عرض طاولات الصالة' },
      { id: 'perm-tables-create', code: 'tables.create', module: 'tables', name: 'إضافة طاولة جديدة' },
      { id: 'perm-tables-edit', code: 'tables.edit', module: 'tables', name: 'تعديل بيانات الطاولات' },
      { id: 'perm-tables-delete', code: 'tables.delete', module: 'tables', name: 'حذف طاولات الصالة' },
      { id: 'perm-tables-transfer', code: 'tables.transfer', module: 'tables', name: 'نقل الطلب بين الطاولات' },

      // Delivery permissions
      { id: 'perm-delivery-view', code: 'delivery.view', module: 'delivery', name: 'عرض طلبات التوصيل' },
      { id: 'perm-delivery-edit', code: 'delivery.edit', module: 'delivery', name: 'تعديل بيانات التوصيل' },
      { id: 'perm-delivery-assign', code: 'delivery.assign_driver', module: 'delivery', name: 'إسناد مندوب توصيل' },
      { id: 'perm-delivery-status', code: 'delivery.change_status', module: 'delivery', name: 'تغيير حالة التوصيل' },
      { id: 'perm-delivery-drivers', code: 'delivery.drivers.manage', module: 'delivery', name: 'إدارة كباتن ومندوبي التوصيل' },
    ];

    for (const perm of newPermissions) {
      await executor.execute(
        `INSERT OR IGNORE INTO permissions (id, code, module, name, description) VALUES (?, ?, ?, ?, ?);`,
        [perm.id, perm.code, perm.module, perm.name, perm.name]
      );
    }

    // Assign role_permissions only if roles already exist (e.g. if migration runs after initial seed)
    const existingRoles = await executor.query<{ id: string }>('SELECT id FROM roles WHERE id IN (?, ?, ?);', [
      'role-admin',
      'role-manager',
      'role-cashier',
    ]);
    const roleIdSet = new Set(existingRoles.map((r) => r.id));

    for (const perm of newPermissions) {
      if (roleIdSet.has('role-admin')) {
        await executor.execute(
          `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?);`,
          ['role-admin', perm.id]
        );
      }
      if (roleIdSet.has('role-manager')) {
        await executor.execute(
          `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?);`,
          ['role-manager', perm.id]
        );
      }
    }

    const cashierCodes = [
      'perm-tables-view',
      'perm-tables-transfer',
      'perm-delivery-view',
      'perm-delivery-edit',
      'perm-delivery-assign',
      'perm-delivery-status',
    ];
    if (roleIdSet.has('role-cashier')) {
      for (const permId of cashierCodes) {
        await executor.execute(
          `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?);`,
          ['role-cashier', permId]
        );
      }
    }

    // 6. Seed Default Dining Tables (طاولة 01 to طاولة 12)
    const defaultTables = [
      { id: 'tbl-01', name: 'طاولة 01', capacity: 4 },
      { id: 'tbl-02', name: 'طاولة 02', capacity: 2 },
      { id: 'tbl-03', name: 'طاولة 03', capacity: 4 },
      { id: 'tbl-04', name: 'طاولة 04', capacity: 6 },
      { id: 'tbl-05', name: 'طاولة 05', capacity: 4 },
      { id: 'tbl-06', name: 'طاولة 06', capacity: 4 },
      { id: 'tbl-07', name: 'طاولة 07', capacity: 2 },
      { id: 'tbl-08', name: 'طاولة 08', capacity: 8 },
      { id: 'tbl-09', name: 'طاولة 09', capacity: 4 },
      { id: 'tbl-10', name: 'طاولة 10', capacity: 4 },
      { id: 'tbl-11', name: 'طاولة 11', capacity: 6 },
      { id: 'tbl-12', name: 'طاولة 12', capacity: 4 },
    ];

    for (const tbl of defaultTables) {
      await executor.execute(
        `INSERT OR IGNORE INTO tables (id, name, capacity, status, is_active, created_at, updated_at)
         VALUES (?, ?, ?, 'AVAILABLE', 1, ?, ?);`,
        [tbl.id, tbl.name, tbl.capacity, now, now]
      );
    }

    // 7. Seed Default Delivery Drivers
    const defaultDrivers = [
      { id: 'driver-01', name: 'طارق عبد العزيز', phone: '01055544433' },
      { id: 'driver-02', name: 'محمود سعد', phone: '01222233344' },
    ];

    for (const d of defaultDrivers) {
      await executor.execute(
        `INSERT OR IGNORE INTO delivery_drivers (id, name, phone, is_active, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?);`,
        [d.id, d.name, d.phone, now, now]
      );
    }
  },
};
