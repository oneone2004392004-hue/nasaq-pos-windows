import { SettingRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';
import { DatabaseManager } from '../database/DatabaseManager';

export interface ISettingsRepository {
  get(key: string): Promise<string | null>;
  getRequired(key: string): Promise<string>;
  set(key: string, value: string, description?: string): Promise<void>;
  getAllSettings(): Promise<Record<string, string>>;
  withTransaction(executor: ISqlExecutor): ISettingsRepository;
}

export class SettingsRepository implements ISettingsRepository {
  private executor: ISqlExecutor;

  constructor(executor?: ISqlExecutor) {
    this.executor = executor || DatabaseManager.getInstance();
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new SettingsRepository(executor) as this;
  }

  public async get(key: string): Promise<string | null> {
    const row = await this.executor.queryOne<SettingRow>(
      'SELECT value FROM settings WHERE key = ?;',
      [key]
    );
    return row ? row.value : null;
  }

  public async getRequired(key: string): Promise<string> {
    const val = await this.get(key);
    if (val === null) {
      throw new Error(`الإعداد المطلوب "${key}" غير موجود في قاعدة البيانات.`);
    }
    return val;
  }

  public async set(key: string, value: string, description?: string): Promise<void> {
    await this.executor.execute(
      `INSERT INTO settings (key, value, description, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         description = COALESCE(excluded.description, settings.description),
         updated_at = excluded.updated_at;`,
      [key, value, description || null, new Date().toISOString()]
    );
  }

  public async getAllSettings(): Promise<Record<string, string>> {
    const rows = await this.executor.query<SettingRow>('SELECT key, value FROM settings;');
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return result;
  }
}
