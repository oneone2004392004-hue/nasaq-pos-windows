import { ISqlExecutor } from '../contracts';
import { Migration } from './types';

export const migration008ReturnOrderItem: Migration = {
  version: 8,
  name: '008_return_items_order_item_id',
  up: async (executor: ISqlExecutor) => {
    const columns = await executor.query<{ name: string }>('PRAGMA table_info(return_items);');
    if (!columns.some((column) => column.name === 'order_item_id')) {
      await executor.execute('ALTER TABLE return_items ADD COLUMN order_item_id TEXT REFERENCES order_items(id);');
    }
    await executor.execute('CREATE INDEX IF NOT EXISTS idx_return_items_order_item ON return_items(order_item_id);');
  },
};
