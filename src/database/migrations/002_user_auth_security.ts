import { ISqlExecutor } from '../contracts';
import { Migration } from './types';

export const migration002: Migration = {
  version: 2,
  name: '002_user_auth_security',
  async up(executor: ISqlExecutor): Promise<void> {
    // Add columns for offline authentication security and lockout protection
    await executor.execute(`
      ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;
    `);

    await executor.execute(`
      ALTER TABLE users ADD COLUMN locked_until TEXT DEFAULT NULL;
    `);

    await executor.execute(`
      ALTER TABLE users ADD COLUMN last_login_at TEXT DEFAULT NULL;
    `);
  },
};
