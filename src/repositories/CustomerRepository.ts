import { BaseRepository } from './BaseRepository';
import { CustomerRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';

export interface ICustomerRepository {
  findById(id: string): Promise<CustomerRow | null>;
  findByPhone(phone: string): Promise<CustomerRow | null>;
  search(query: string): Promise<CustomerRow[]>;
  create(customer: CustomerRow): Promise<CustomerRow>;
  update(id: string, updates: Partial<CustomerRow>): Promise<CustomerRow>;
  getCustomerStats(customerId: string): Promise<{ ordersCount: number; totalSpentMinor: number }>;
}

export class CustomerRepository extends BaseRepository<CustomerRow> implements ICustomerRepository {
  constructor(executor?: ISqlExecutor) {
    super('customers', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new CustomerRepository(executor) as this;
  }

  public async findByPhone(phone: string): Promise<CustomerRow | null> {
    return await this.executor.queryOne<CustomerRow>(
      'SELECT * FROM customers WHERE phone = ?;',
      [phone.trim()]
    );
  }

  public async search(query: string): Promise<CustomerRow[]> {
    const q = `%${query.trim()}%`;
    return await this.executor.query<CustomerRow>(
      `SELECT * FROM customers
       WHERE name LIKE ? OR phone LIKE ?
       ORDER BY name ASC LIMIT 30;`,
      [q, q]
    );
  }

  public async getCustomerStats(customerId: string): Promise<{ ordersCount: number; totalSpentMinor: number }> {
    const res = await this.executor.queryOne<{ count: number; total: number }>(
      `SELECT COUNT(id) AS count, COALESCE(SUM(total), 0) AS total
       FROM orders
       WHERE customer_id = ? AND status = 'COMPLETED';`,
      [customerId]
    );
    return {
      ordersCount: res?.count ?? 0,
      totalSpentMinor: res?.total ?? 0,
    };
  }
}
