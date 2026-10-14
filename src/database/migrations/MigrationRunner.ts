import { ISqlExecutor } from '../contracts';
import { Migration } from './types';
import { migration001 } from './001_initial_schema';
import { migration002 } from './002_user_auth_security';
import { migration003 } from './003_tables_and_delivery';
import { migration004 } from './004_cash_register_shifts';
import { migration005 } from './005_phase2_controls';
import { migration006Phase3PrinterEncoding } from './006_phase3_printer_encoding';
import { migration007PhaseAReturns } from './007_phaseA_returns';
import { migration008ReturnOrderItem } from './008_return_order_item';
import { migration009CustomerActiveState } from './009_customer_active_state';

export class MigrationRunner {
  private migrations: Migration[] = [migration001, migration002, migration003, migration004, migration005, migration006Phase3PrinterEncoding, migration007PhaseAReturns, migration008ReturnOrderItem, migration009CustomerActiveState];

  constructor(customMigrations?: Migration[]) {
    if (customMigrations) {
      this.migrations = customMigrations;
    }
    // Ensure sorted by version ascending
    this.migrations.sort((a, b) => a.version - b.version);
  }

  public async initMigrationTable(executor: ISqlExecutor): Promise<void> {
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
  }

  public async getAppliedVersions(executor: ISqlExecutor): Promise<number[]> {
    await this.initMigrationTable(executor);
    const rows = await executor.query<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC;'
    );
    return rows.map((r) => r.version);
  }

  public async runPending(executor: ISqlExecutor): Promise<{ applied: number[]; skipped: number[] }> {
    await this.initMigrationTable(executor);
    const appliedVersions = await this.getAppliedVersions(executor);
    const appliedSet = new Set(appliedVersions);

    const newlyApplied: number[] = [];
    const skipped: number[] = [];

    for (const migration of this.migrations) {
      if (appliedSet.has(migration.version)) {
        skipped.push(migration.version);
        continue;
      }

      // Run each migration inside a dedicated atomic transaction
      await executor.transaction(async (tx) => {
        await migration.up(tx);
        await tx.execute(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          [migration.version, migration.name, new Date().toISOString()]
        );
      });

      newlyApplied.push(migration.version);
    }

    return { applied: newlyApplied, skipped };
  }
}
