import { BaseRepository } from './BaseRepository';
import { PrinterRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';

export interface IPrinterRepository {
  findById(id: string): Promise<PrinterRow | null>;
  getDefault(type: 'RECEIPT' | 'KITCHEN'): Promise<PrinterRow | null>;
  listActive(): Promise<PrinterRow[]>;
  setDefault(id: string, type: 'RECEIPT' | 'KITCHEN'): Promise<void>;
  create(printer: PrinterRow): Promise<PrinterRow>;
  update(id: string, updates: Partial<PrinterRow>): Promise<PrinterRow>;
}

export class PrinterRepository extends BaseRepository<PrinterRow> implements IPrinterRepository {
  constructor(executor?: ISqlExecutor) {
    super('printers', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new PrinterRepository(executor) as this;
  }

  public async getDefault(type: 'RECEIPT' | 'KITCHEN'): Promise<PrinterRow | null> {
    return await this.executor.queryOne<PrinterRow>(
      'SELECT * FROM printers WHERE printer_type = ? AND is_default = 1 AND is_active = 1 LIMIT 1;',
      [type]
    );
  }

  public async listActive(): Promise<PrinterRow[]> {
    return await this.executor.query<PrinterRow>(
      'SELECT * FROM printers WHERE is_active = 1 ORDER BY name ASC;'
    );
  }

  public async setDefault(id: string, type: 'RECEIPT' | 'KITCHEN'): Promise<void> {
    await this.executor.transaction(async (tx) => {
      // Clear current default for this type
      await tx.execute(
        'UPDATE printers SET is_default = 0 WHERE printer_type = ?;',
        [type]
      );
      // Set new default
      await tx.execute(
        'UPDATE printers SET is_default = 1 WHERE id = ?;',
        [id]
      );
    });
  }
}
