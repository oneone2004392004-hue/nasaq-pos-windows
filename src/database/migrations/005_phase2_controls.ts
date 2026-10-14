import { ISqlExecutor } from '../contracts';
import { Migration } from './types';

/**
 * Forward-only Phase 2 migration.
 * Rollback is intentionally non-destructive: restore a verified backup instead
 * of dropping financial columns or records.
 */
export const migration005: Migration = {
  version: 5,
  name: '005_phase2_controls',
  async up(executor: ISqlExecutor): Promise<void> {
    await executor.execute(`
      INSERT OR IGNORE INTO settings (key, value, description, updated_at)
      VALUES ('tax_inclusive', '0', 'هل السعر شامل الضريبة', ?);
    `, [new Date().toISOString()]);
    await executor.execute(`
      INSERT OR IGNORE INTO settings (key, value, description, updated_at)
      VALUES ('allow_negative_stock', '0', 'السماح بالبيع من رصيد سالب', ?);
    `, [new Date().toISOString()]);
    await executor.execute(`
      INSERT OR IGNORE INTO permissions (id, code, module, name, description)
      VALUES ('perm-users-reset-password', 'users.reset_password', 'users', 'إعادة تعيين كلمة مرور مستخدم', 'إعادة تعيين كلمة المرور من مسؤول النظام');
    `);
    await executor.execute(`
      INSERT OR IGNORE INTO permissions (id, code, module, name, description)
      VALUES ('perm-returns-refund', 'returns.refund', 'returns', 'اعتماد مرتجع مالي', 'تنفيذ رد قيمة مرتجع');
    `);
    const roles = await executor.query<{ id: string }>(
      `SELECT id FROM roles WHERE id IN ('role-admin', 'role-manager');`
    );
    for (const role of roles) {
      const permissions = await executor.query<{ id: string }>(
        `SELECT id FROM permissions WHERE code IN ('users.reset_password', 'returns.refund');`
      );
      for (const permission of permissions) {
        await executor.execute(
          `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?);`,
          [role.id, permission.id]
        );
      }
    }
  },
};
