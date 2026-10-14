import { DatabaseManager } from '../../../database/DatabaseManager';
import { ValidationError, NotFoundError } from '../../../database/errors';
import { CustomerRow } from '../../../domain/dbModels';
import { generateId } from '../../../utils/id';
import { AuthenticatedUser } from '../../auth/types';
import { requirePermission } from '../../auth/utils/permissions';
import { AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { CustomerRepository } from '../../../repositories/CustomerRepository';

export interface CustomerInput { name: string; phone?: string | null; address?: string | null; }
export class CustomerService {
  constructor(
    private readonly db = DatabaseManager.getInstance(),
    private readonly customers = new CustomerRepository(db),
    private readonly audit = new AuditLogRepository(db),
  ) {}

  async create(user: AuthenticatedUser, input: CustomerInput): Promise<CustomerRow> {
    requirePermission(user, 'customers.create', this.audit);
    const valid = this.validate(input);
    const now = new Date().toISOString();
    const customer: CustomerRow = {
      id: generateId('customer'), ...valid, notes: null, is_active: 1, created_at: now, updated_at: now,
    };
    const saved = await this.customers.create(customer);
    await this.audit.log('CUSTOMER_CREATED', 'customer', saved.id, user.id, { name: saved.name, phone: saved.phone });
    return saved;
  }

  async update(user: AuthenticatedUser, id: string, input: CustomerInput): Promise<CustomerRow> {
    requirePermission(user, 'customers.edit', this.audit);
    const customer = await this.customers.findById(id);
    if (!customer) throw new NotFoundError('Customer', id);
    const valid = this.validate(input);
    const updated = await this.customers.update(id, { ...valid, updated_at: new Date().toISOString() });
    await this.audit.log('CUSTOMER_UPDATED', 'customer', id, user.id, {
      previous: { name: customer.name, phone: customer.phone, address: customer.address }, updated: valid,
    });
    return updated;
  }

  async setActive(user: AuthenticatedUser, id: string, active: boolean): Promise<CustomerRow> {
    requirePermission(user, 'customers.edit', this.audit);
    const customer = await this.customers.findById(id);
    if (!customer) throw new NotFoundError('Customer', id);
    const updated = await this.customers.update(id, { is_active: active ? 1 : 0, updated_at: new Date().toISOString() });
    await this.audit.log(active ? 'CUSTOMER_ACTIVATED' : 'CUSTOMER_DEACTIVATED', 'customer', id, user.id, { name: customer.name });
    return updated;
  }

  private validate(input: CustomerInput): { name: string; phone: string | null; address: string | null } {
    const name = input?.name?.trim();
    if (!name) throw new ValidationError('اسم العميل مطلوب.');
    if (name.length > 120) throw new ValidationError('اسم العميل يجب ألا يتجاوز 120 حرفاً.');
    const phone = input.phone?.trim() || null;
    const address = input.address?.trim() || null;
    if (phone && phone.length > 30) throw new ValidationError('رقم هاتف العميل غير صالح.');
    return { name, phone, address };
  }
}
