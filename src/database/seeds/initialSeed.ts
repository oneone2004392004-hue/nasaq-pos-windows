import { ISqlExecutor } from '../contracts';

export const DEFAULT_ROLES = [
  { id: 'role-admin', code: 'ADMIN', name: 'مدير النظام', description: 'صلاحيات كاملة على كافة العمليات والإعدادات المالية والتقارير', is_system: 1 },
  { id: 'role-manager', code: 'MANAGER', name: 'مشرف الفرع', description: 'إدارة العمليات اليومية والمخزون والورديات والتقارير', is_system: 1 },
  { id: 'role-cashier', code: 'CASHIER', name: 'كاشير مبيعات', description: 'تسجيل طلبات البيع والسداد وفتح وإغلاق الوردية الخاصة به', is_system: 1 },
];

export const DEFAULT_PERMISSIONS = [
  // POS
  { id: 'perm-pos-view', code: 'pos.view_menu', module: 'pos', name: 'عرض القائمة والأصناف' },
  { id: 'perm-pos-create', code: 'pos.create_order', module: 'pos', name: 'إنشاء طلب بيع جديد' },
  { id: 'perm-pos-discount', code: 'pos.apply_discount', module: 'pos', name: 'تطبيق خصم على الفاتورة' },
  { id: 'perm-pos-cancel-item', code: 'pos.cancel_item', module: 'pos', name: 'إلغاء صنف من الطلب' },
  { id: 'perm-pos-cancel-order', code: 'pos.cancel_order', module: 'pos', name: 'إلغاء طلب معلق' },
  { id: 'perm-pos-reprint', code: 'pos.reprint_receipt', module: 'pos', name: 'إعادة طباعة إيصال الفاتورة' },

  // Orders
  { id: 'perm-orders-view', code: 'orders.view', module: 'orders', name: 'عرض سجل الطلبات' },
  { id: 'perm-orders-manage', code: 'orders.manage', module: 'orders', name: 'تعديل وحذف الطلبات' },

  // Products & Categories
  { id: 'perm-products-view', code: 'products.view', module: 'products', name: 'عرض دليل الأصناف' },
  { id: 'perm-products-create', code: 'products.create', module: 'products', name: 'إضافة أصناف جديدة' },
  { id: 'perm-products-edit', code: 'products.edit', module: 'products', name: 'تعديل بيانات وأسعار الأصناف' },
  { id: 'perm-products-delete', code: 'products.delete', module: 'products', name: 'حذف أو تعطيل الأصناف' },
  { id: 'perm-categories-manage', code: 'categories.manage', module: 'categories', name: 'إدارة التصنيفات والأقسام' },

  // Customers
  { id: 'perm-customers-view', code: 'customers.view', module: 'customers', name: 'عرض دليل العملاء' },
  { id: 'perm-customers-create', code: 'customers.create', module: 'customers', name: 'إضافة عميل جديد' },
  { id: 'perm-customers-edit', code: 'customers.edit', module: 'customers', name: 'تعديل بيانات العملاء' },

  // Shifts
  { id: 'perm-shifts-open', code: 'shifts.open', module: 'shifts', name: 'فتح وردية كاشير جديدة' },
  { id: 'perm-shifts-close', code: 'shifts.close', module: 'shifts', name: 'إغلاق الوردية والجرد' },
  { id: 'perm-shifts-view-all', code: 'shifts.view_all', module: 'shifts', name: 'عرض كافة ورديات الكاشير' },

  // Cash Register
  { id: 'perm-cash-view', code: 'cash.view_balance', module: 'cash', name: 'عرض رصيد الدرج' },
  { id: 'perm-cash-deposit', code: 'cash.deposit', module: 'cash', name: 'إيداع نقدية بالدرج' },
  { id: 'perm-cash-withdraw', code: 'cash.withdraw', module: 'cash', name: 'سحب نقدية من الدرج' },

  // Expenses
  { id: 'perm-expenses-view', code: 'expenses.view', module: 'expenses', name: 'عرض سجل المصروفات' },
  { id: 'perm-expenses-create', code: 'expenses.create', module: 'expenses', name: 'تسجيل مصروفات نقدية' },

  // Inventory
  { id: 'perm-inventory-view', code: 'inventory.view', module: 'inventory', name: 'عرض أرصدة المخزون' },
  { id: 'perm-inventory-adjust', code: 'inventory.adjust', module: 'inventory', name: 'تسوية الجرد وإضافة مخزون' },

  // Returns
  { id: 'perm-returns-create', code: 'returns.create', module: 'returns', name: 'إجراء مرتجع مبيعات' },
  { id: 'perm-returns-view', code: 'returns.view', module: 'returns', name: 'عرض سجل المرتجعات' },

  // Reports
  { id: 'perm-reports-sales', code: 'reports.sales', module: 'reports', name: 'عرض تقارير المبيعات' },
  { id: 'perm-reports-shifts', code: 'reports.shifts', module: 'reports', name: 'عرض تقارير الورديات' },
  { id: 'perm-reports-financial', code: 'reports.financial', module: 'reports', name: 'عرض المؤشرات المالية' },

  // Users & Settings
  { id: 'perm-users-manage', code: 'users.manage', module: 'users', name: 'إدارة المستخدمين والصلاحيات' },
  { id: 'perm-users-reset-password', code: 'users.reset_password', module: 'users', name: 'إعادة تعيين كلمة مرور مستخدم' },
  { id: 'perm-returns-refund', code: 'returns.refund', module: 'returns', name: 'اعتماد مرتجع مالي' },
  { id: 'perm-settings-view', code: 'settings.view', module: 'settings', name: 'عرض إعدادات المنشأة' },
  { id: 'perm-settings-edit', code: 'settings.edit', module: 'settings', name: 'تعديل إعدادات النظام والفواتير' },

  // System
  { id: 'perm-system-backup', code: 'system.backup', module: 'system', name: 'إنشاء نسخة احتياطية' },
  { id: 'perm-system-restore', code: 'system.restore', module: 'system', name: 'استعادة نسخة احتياطية' },

  // Tables
  { id: 'perm-tables-view', code: 'tables.view', module: 'tables', name: 'عرض طاولات الصالة' },
  { id: 'perm-tables-create', code: 'tables.create', module: 'tables', name: 'إضافة طاولة جديدة' },
  { id: 'perm-tables-edit', code: 'tables.edit', module: 'tables', name: 'تعديل بيانات الطاولات' },
  { id: 'perm-tables-delete', code: 'tables.delete', module: 'tables', name: 'حذف طاولات الصالة' },
  { id: 'perm-tables-transfer', code: 'tables.transfer', module: 'tables', name: 'نقل الطلب بين الطاولات' },

  // Delivery
  { id: 'perm-delivery-view', code: 'delivery.view', module: 'delivery', name: 'عرض طلبات التوصيل' },
  { id: 'perm-delivery-edit', code: 'delivery.edit', module: 'delivery', name: 'تعديل بيانات التوصيل' },
  { id: 'perm-delivery-assign', code: 'delivery.assign_driver', module: 'delivery', name: 'إسناد مندوب توصيل' },
  { id: 'perm-delivery-status', code: 'delivery.change_status', module: 'delivery', name: 'تغيير حالة التوصيل' },
  { id: 'perm-delivery-drivers', code: 'delivery.drivers.manage', module: 'delivery', name: 'إدارة كباتن ومندوبي التوصيل' },
];

export const DEFAULT_SETTINGS: Record<string, string> = {
  store_name: 'مطعم نسق',
  store_phone: '01000000000',
  store_address: 'القاهرة - جمهورية مصر العربية',
  currency: 'EGP',
  tax_enabled: '0',
  default_tax_rate: '0',
  receipt_width: '80',
  auto_cash_drawer: '1',
  setup_completed: '0',
};

/**
 * Executes production system initialization seeds idempotently
 */
export async function runInitialSeed(executor: ISqlExecutor): Promise<void> {
  await executor.transaction(async (tx) => {
    const now = new Date().toISOString();

    // 1. Insert Default Roles if not already present
    for (const role of DEFAULT_ROLES) {
      await tx.execute(
        `INSERT OR IGNORE INTO roles (id, code, name, description, is_system, created_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [role.id, role.code, role.name, role.description, role.is_system, now]
      );
    }

    // 2. Insert Default Permissions if not already present
    for (const perm of DEFAULT_PERMISSIONS) {
      await tx.execute(
        `INSERT OR IGNORE INTO permissions (id, code, module, name, description)
         VALUES (?, ?, ?, ?, ?);`,
        [perm.id, perm.code, perm.module, perm.name, perm.name]
      );
    }

    // 3. Map Roles to Permissions
    // ADMIN gets all permissions
    for (const perm of DEFAULT_PERMISSIONS) {
      await tx.execute(
        `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?);`,
        ['role-admin', perm.id]
      );
    }

    // MANAGER permissions
    const managerModules = ['pos', 'orders', 'products', 'categories', 'customers', 'shifts', 'cash', 'expenses', 'inventory', 'returns', 'reports', 'tables', 'delivery'];
    for (const perm of DEFAULT_PERMISSIONS) {
      if (managerModules.includes(perm.module) || perm.code === 'settings.view' || perm.code === 'system.backup') {
        await tx.execute(
          `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?);`,
          ['role-manager', perm.id]
        );
      }
    }

    // CASHIER permissions (Only essential cashier sales operations)
    const cashierCodes = [
      'pos.view_menu',
      'pos.create_order',
      'pos.apply_discount',
      'pos.reprint_receipt',
      'orders.view',
      'shifts.open',
      'shifts.close',
      'cash.view_balance',
      'cash.deposit',
      'customers.view',
      'customers.create',
      'tables.view',
      'tables.transfer',
      'delivery.view',
      'delivery.edit',
      'delivery.assign_driver',
      'delivery.change_status',
    ];
    for (const perm of DEFAULT_PERMISSIONS) {
      if (cashierCodes.includes(perm.code)) {
        await tx.execute(
          `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?);`,
          ['role-cashier', perm.id]
        );
      }
    }

    // 4. Insert Default Settings
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await tx.execute(
        `INSERT OR IGNORE INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, ?);`,
        [key, value, `إعداد افتراضي: ${key}`, now]
      );
    }

    // Record installation timestamp if not present
    await tx.execute(
      `INSERT OR IGNORE INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, ?);`,
      ['installed_at', now, 'تاريخ تثبيت وتشغيل النظام لأول مرة', now]
    );
  });
}
