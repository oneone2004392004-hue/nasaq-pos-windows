import { Migration } from './types';

export const migration009CustomerActiveState: Migration = {
  version: 9,
  name: 'customer_active_state',
  up: async (executor) => {
    const columns = await executor.query<{ name: string }>('PRAGMA table_info(customers);');
    if (!columns.some((column) => column.name === 'is_active')) {
      await executor.execute("ALTER TABLE customers ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));");
    }
  },
};
