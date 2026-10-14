import { Migration } from './types';
import { ISqlExecutor } from '../contracts';

export const migration006Phase3PrinterEncoding: Migration = {
  version: 6,
  name: 'phase3_printer_encoding',
  up: async (executor: ISqlExecutor) => {
    await executor.execute("ALTER TABLE printers ADD COLUMN code_page TEXT NOT NULL DEFAULT 'CP864';");
    await executor.execute("ALTER TABLE printers ADD COLUMN print_mode TEXT NOT NULL DEFAULT 'RAW';");
  },
};
