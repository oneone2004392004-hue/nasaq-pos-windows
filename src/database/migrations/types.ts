import { ISqlExecutor } from '../contracts';

export interface Migration {
  version: number;
  name: string;
  up(executor: ISqlExecutor): Promise<void>;
  down?(executor: ISqlExecutor): Promise<void>;
}

export interface AppliedMigration {
  version: number;
  name: string;
  applied_at: string;
}
