import { Migration } from './types';
import { ISqlExecutor } from '../contracts';

export const migration007PhaseAReturns: Migration = {
  version: 7,
  name: 'phaseA_returns_original_shift',
  up: async (executor: ISqlExecutor) => {
    const columns = await executor.query<{ name: string }>('PRAGMA table_info(returns);');
    if (!columns.some((column) => column.name === 'original_shift_id')) {
      await executor.execute('ALTER TABLE returns ADD COLUMN original_shift_id TEXT REFERENCES cash_shifts(id);');
    }
    await executor.execute('CREATE INDEX IF NOT EXISTS idx_returns_original_shift ON returns(original_shift_id);');
  },
};
