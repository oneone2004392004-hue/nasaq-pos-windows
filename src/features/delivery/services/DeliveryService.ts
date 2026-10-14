import { DatabaseManager } from '../../../database/DatabaseManager';
import { DeliveryDriverRepository } from '../../../repositories/DeliveryDriverRepository';
import { OrderRepository } from '../../../repositories/OrderRepository';
import { OrderItemRepository } from '../../../repositories/OrderItemRepository';
import { CustomerRepository } from '../../../repositories/CustomerRepository';
import { AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { AuthenticatedUser } from '../../auth/types';
import { requirePermission, requireAnyPermission } from '../../auth/utils/permissions';
import { DeliveryDriverRow, OrderRow, OrderItemRow } from '../../../domain/dbModels';
import { DeliveryStatus, OrderType } from '../../../domain/enums';
import { ValidationError, NotFoundError, ConflictError } from '../../../database/errors';
import { generateId } from '../../../utils/id';
import {
  CreateDriverDTO,
  UpdateDriverDTO,
  UpdateDeliveryInfoDTO,
  DeliveryFilterParams,
  DeliveryOrderListItemDTO,
  DeliveryOrderDetailDTO,
} from '../types';
import {
  validateCreateDriver,
  validateUpdateDriver,
  validateUpdateDeliveryInfo,
  validateDeliveryStatus,
} from '../validation';

export interface IDeliveryService {
  listDrivers(activeOnly?: boolean): Promise<DeliveryDriverRow[]>;
  getDriverById(id: string): Promise<DeliveryDriverRow>;
  createDriver(user: AuthenticatedUser, data: CreateDriverDTO): Promise<DeliveryDriverRow>;
  updateDriver(user: AuthenticatedUser, id: string, data: UpdateDriverDTO): Promise<DeliveryDriverRow>;
  deleteDriver(user: AuthenticatedUser, id: string): Promise<boolean>;

  listDeliveryOrders(user: AuthenticatedUser, filters?: DeliveryFilterParams): Promise<DeliveryOrderListItemDTO[]>;
  getDeliveryOrderDetails(user: AuthenticatedUser, orderId: string): Promise<DeliveryOrderDetailDTO>;
  assignDriver(user: AuthenticatedUser, orderId: string, driverId: string | null): Promise<OrderRow>;
  updateDeliveryStatus(user: AuthenticatedUser, orderId: string, status: DeliveryStatus): Promise<OrderRow>;
  updateDeliveryInfo(user: AuthenticatedUser, orderId: string, data: UpdateDeliveryInfoDTO): Promise<OrderRow>;
}

export class DeliveryService implements IDeliveryService {
  private dbManager: DatabaseManager;
  private driverRepo: DeliveryDriverRepository;
  private orderRepo: OrderRepository;
  private orderItemRepo: OrderItemRepository;
  private customerRepo: CustomerRepository;
  private auditRepo: AuditLogRepository;

  constructor(
    dbManager?: DatabaseManager,
    driverRepo?: DeliveryDriverRepository,
    orderRepo?: OrderRepository,
    orderItemRepo?: OrderItemRepository,
    customerRepo?: CustomerRepository,
    auditRepo?: AuditLogRepository
  ) {
    this.dbManager = dbManager || DatabaseManager.getInstance();
    this.driverRepo = driverRepo || new DeliveryDriverRepository();
    this.orderRepo = orderRepo || new OrderRepository();
    this.orderItemRepo = orderItemRepo || new OrderItemRepository();
    this.customerRepo = customerRepo || new CustomerRepository();
    this.auditRepo = auditRepo || new AuditLogRepository();
  }

  // --- Driver Management ---

  public async listDrivers(activeOnly = false): Promise<DeliveryDriverRow[]> {
    return await this.driverRepo.listAll(activeOnly);
  }

  public async getDriverById(id: string): Promise<DeliveryDriverRow> {
    const driver = await this.driverRepo.findById(id);
    if (!driver) {
      throw new NotFoundError('DeliveryDriver', id);
    }
    return driver;
  }

  public async createDriver(user: AuthenticatedUser, data: CreateDriverDTO): Promise<DeliveryDriverRow> {
    requirePermission(user, 'delivery.drivers.manage', this.auditRepo);
    const validated = validateCreateDriver(data);

    // Unique phone check
    const existing = await this.driverRepo.findByPhone(validated.phone);
    if (existing) {
      throw new ValidationError(`رقم هاتف المندوب "${validated.phone}" مسجل مسبقاً.`);
    }

    const now = new Date().toISOString();
    const newId = generateId('driver');

    const newDriver: DeliveryDriverRow = {
      id: newId,
      name: validated.name,
      phone: validated.phone,
      is_active: 1,
      created_at: now,
      updated_at: now,
    };

    const saved = await this.driverRepo.create(newDriver);

    await this.auditRepo.log('DELIVERY_DRIVER_CREATED', 'driver', saved.id, user.id, {
      name: saved.name,
      phone: saved.phone,
    });

    return saved;
  }

  public async updateDriver(
    user: AuthenticatedUser,
    id: string,
    data: UpdateDriverDTO
  ): Promise<DeliveryDriverRow> {
    requirePermission(user, 'delivery.drivers.manage', this.auditRepo);
    const validated = validateUpdateDriver(data);

    const driver = await this.getDriverById(id);

    // Phone uniqueness check if changed
    if (validated.phone && validated.phone !== driver.phone) {
      const existing = await this.driverRepo.findByPhone(validated.phone);
      if (existing && existing.id !== driver.id) {
        throw new ValidationError(`رقم هاتف المندوب "${validated.phone}" مسجل مسبقاً.`);
      }
    }

    const now = new Date().toISOString();
    const updates: Partial<DeliveryDriverRow> = {
      ...validated,
      updated_at: now,
    };

    const updated = await this.driverRepo.update(id, updates);

    await this.auditRepo.log('DELIVERY_DRIVER_UPDATED', 'driver', updated.id, user.id, {
      previous: { name: driver.name, phone: driver.phone, is_active: driver.is_active },
      updated: updates,
    });

    return updated;
  }

  public async deleteDriver(user: AuthenticatedUser, id: string): Promise<boolean> {
    requirePermission(user, 'delivery.drivers.manage', this.auditRepo);
    const driver = await this.getDriverById(id);

    const activeCount = await this.driverRepo.getActiveOrdersCount(id);
    if (activeCount > 0) {
      throw new ConflictError(
        `لا يمكن حذف المندوب (${driver.name}) لوجود ${activeCount} طلب جاري معه حالياً.`
      );
    }

    const deleted = await this.driverRepo.safeDelete(id);

    if (deleted) {
      await this.auditRepo.log('DELIVERY_DRIVER_DELETED', 'driver', id, user.id, {
        name: driver.name,
        phone: driver.phone,
      });
    }

    return deleted;
  }

  // --- Delivery Orders Management ---

  public async listDeliveryOrders(
    user: AuthenticatedUser,
    filters: DeliveryFilterParams = {}
  ): Promise<DeliveryOrderListItemDTO[]> {
    requireAnyPermission(user, ['delivery.view', 'orders.view'], this.auditRepo);

    let sql = `
      SELECT 
        o.id,
        o.order_number,
        o.order_type,
        o.status,
        COALESCE(o.delivery_status, 'PENDING') AS delivery_status,
        o.customer_id,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.address AS customer_address,
        o.delivery_driver_id,
        dd.name AS delivery_driver_name,
        dd.phone AS delivery_driver_phone,
        o.delivery_fee,
        o.subtotal,
        o.discount_amount,
        o.tax_amount,
        o.total,
        o.notes,
        COALESCE((SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id), 0) AS items_count,
        o.created_at,
        o.updated_at
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN delivery_drivers dd ON o.delivery_driver_id = dd.id
      WHERE o.order_type = 'DELIVERY'
    `;

    const params: unknown[] = [];

    if (filters.deliveryStatus && filters.deliveryStatus !== 'ALL') {
      sql += ' AND COALESCE(o.delivery_status, \'PENDING\') = ?';
      params.push(filters.deliveryStatus);
    }

    if (filters.driverId && filters.driverId !== 'ALL') {
      if (filters.driverId === 'UNASSIGNED') {
        sql += ' AND o.delivery_driver_id IS NULL';
      } else {
        sql += ' AND o.delivery_driver_id = ?';
        params.push(filters.driverId);
      }
    }

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      sql += ' AND (o.order_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR c.address LIKE ? OR dd.name LIKE ?)';
      params.push(term, term, term, term, term);
    }

    if (filters.datePreset && filters.datePreset !== 'ALL') {
      const refDate = filters.referenceDate || new Date().toISOString();
      const refYMD = refDate.slice(0, 10);

      if (filters.datePreset === 'TODAY') {
        sql += ' AND date(o.created_at) = ?';
        params.push(refYMD);
      } else if (filters.datePreset === 'YESTERDAY') {
        const d = new Date(refDate);
        d.setDate(d.getDate() - 1);
        const yesterdayYMD = d.toISOString().slice(0, 10);
        sql += ' AND date(o.created_at) = ?';
        params.push(yesterdayYMD);
      } else if (filters.datePreset === 'THIS_WEEK') {
        const d = new Date(refDate);
        d.setDate(d.getDate() - 6);
        const weekStartYMD = d.toISOString().slice(0, 10);
        sql += ' AND date(o.created_at) >= ? AND date(o.created_at) <= ?';
        params.push(weekStartYMD, refYMD);
      } else if (filters.datePreset === 'CUSTOM' && filters.customDate) {
        sql += ' AND date(o.created_at) = ?';
        params.push(filters.customDate);
      }
    }

    sql += ' ORDER BY o.created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
      if (filters.offset) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    return await this.dbManager.query<DeliveryOrderListItemDTO>(sql, params);
  }

  public async getDeliveryOrderDetails(
    user: AuthenticatedUser,
    orderId: string
  ): Promise<DeliveryOrderDetailDTO> {
    requireAnyPermission(user, ['delivery.view', 'orders.view'], this.auditRepo);

    const orders = await this.listDeliveryOrders(user, { search: orderId, limit: 1 });
    let order = orders.find((o) => o.id === orderId);

    if (!order) {
      // Direct query fallback
      const direct = await this.dbManager.queryOne<DeliveryOrderListItemDTO>(
        `SELECT 
          o.id,
          o.order_number,
          o.order_type,
          o.status,
          COALESCE(o.delivery_status, 'PENDING') AS delivery_status,
          o.customer_id,
          c.name AS customer_name,
          c.phone AS customer_phone,
          c.address AS customer_address,
          o.delivery_driver_id,
          dd.name AS delivery_driver_name,
          dd.phone AS delivery_driver_phone,
          o.delivery_fee,
          o.subtotal,
          o.discount_amount,
          o.tax_amount,
          o.total,
          o.notes,
          COALESCE((SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id), 0) AS items_count,
          o.created_at,
          o.updated_at
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN delivery_drivers dd ON o.delivery_driver_id = dd.id
        WHERE o.id = ? AND o.order_type = 'DELIVERY';`,
        [orderId]
      );
      if (!direct) {
        throw new NotFoundError('DeliveryOrder', orderId);
      }
      order = direct;
    }

    const items = await this.orderItemRepo.listByOrderId(orderId);

    return {
      order,
      items,
    };
  }

  public async assignDriver(
    user: AuthenticatedUser,
    orderId: string,
    driverId: string | null
  ): Promise<OrderRow> {
    requireAnyPermission(user, ['delivery.assign_driver', 'orders.manage'], this.auditRepo);

    const order = await this.orderRepo.findById(orderId);
    if (!order) throw new NotFoundError('Order', orderId);

    if (order.order_type !== OrderType.DELIVERY) {
      throw new ValidationError('إسناد المندوب متاح فقط لطلبات التوصيل (Delivery).');
    }

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new ValidationError(`لا يمكن تغيير مندوب طلب بحالة "${order.status}".`);
    }

    let driverName: string | null = null;
    if (driverId) {
      const driver = await this.getDriverById(driverId);
      if (driver.is_active !== 1) {
        throw new ValidationError(`مندوب التوصيل (${driver.name}) غير متاح حالياً.`);
      }
      driverName = driver.name;
    }

    const now = new Date().toISOString();
    const updated = await this.orderRepo.update(orderId, {
      delivery_driver_id: driverId,
      updated_at: now,
    });

    await this.auditRepo.log('DELIVERY_DRIVER_ASSIGNED', 'order', orderId, user.id, {
      order_number: order.order_number,
      delivery_driver_id: driverId,
      delivery_driver_name: driverName,
    });

    return updated;
  }

  public async updateDeliveryStatus(
    user: AuthenticatedUser,
    orderId: string,
    status: DeliveryStatus
  ): Promise<OrderRow> {
    requireAnyPermission(user, ['delivery.change_status', 'orders.manage'], this.auditRepo);
    const validStatus = validateDeliveryStatus(status);

    const order = await this.orderRepo.findById(orderId);
    if (!order) throw new NotFoundError('Order', orderId);

    if (order.order_type !== OrderType.DELIVERY) {
      throw new ValidationError('تحديث حالة التوصيل متاح فقط لطلبات التوصيل (Delivery).');
    }

    const currentDeliveryStatus = (order.delivery_status || 'PENDING') as DeliveryStatus;

    if (currentDeliveryStatus === DeliveryStatus.DELIVERED) {
      throw new ConflictError('الطلب تم تسليمه بالفعل ولا يمكن تغيير حالته.');
    }

    if (currentDeliveryStatus === DeliveryStatus.CANCELLED || order.status === 'CANCELLED') {
      throw new ConflictError('الطلب ملغي ولا يمكن تغيير حالة التوصيل الخاصة به.');
    }

    // Constraint: Cannot move to OUT_FOR_DELIVERY without assigning a driver
    if (validStatus === DeliveryStatus.OUT_FOR_DELIVERY && !order.delivery_driver_id) {
      throw new ValidationError('يجب إسناد مندوب توصيل قبل تحويل حالة الطلب إلى "خرج للتوصيل".');
    }

    const now = new Date().toISOString();
    const updates: Partial<OrderRow> = {
      delivery_status: validStatus,
      updated_at: now,
    };

    const updated = await this.orderRepo.update(orderId, updates);

    await this.auditRepo.log('DELIVERY_STATUS_UPDATED', 'order', orderId, user.id, {
      order_number: order.order_number,
      previous_status: currentDeliveryStatus,
      new_status: validStatus,
      driver_id: order.delivery_driver_id,
    });

    return updated;
  }

  public async updateDeliveryInfo(
    user: AuthenticatedUser,
    orderId: string,
    data: UpdateDeliveryInfoDTO
  ): Promise<OrderRow> {
    requireAnyPermission(user, ['delivery.edit', 'orders.manage'], this.auditRepo);
    const validated = validateUpdateDeliveryInfo(data);

    const order = await this.orderRepo.findById(orderId);
    if (!order) throw new NotFoundError('Order', orderId);

    if (order.order_type !== OrderType.DELIVERY) {
      throw new ValidationError('تعديل بيانات التوصيل متاح فقط لطلبات التوصيل (Delivery).');
    }

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new ValidationError(`لا يمكن تعديل بيانات توصيل لطلب بحالة "${order.status}".`);
    }

    return await this.dbManager.transaction(async (tx) => {
      const txOrderRepo = new OrderRepository(tx);
      const txCustomerRepo = new CustomerRepository(tx);
      const txAuditRepo = new AuditLogRepository(tx);

      // Update or link customer if needed
      if (order.customer_id) {
        const customerUpdates: { name?: string; phone?: string; address?: string } = {};
        if (validated.customer_name) customerUpdates.name = validated.customer_name;
        if (validated.customer_phone) customerUpdates.phone = validated.customer_phone;
        if (validated.customer_address !== undefined) customerUpdates.address = validated.customer_address || undefined;

        if (Object.keys(customerUpdates).length > 0) {
          await txCustomerRepo.update(order.customer_id, customerUpdates);
        }
      }

      const now = new Date().toISOString();
      const orderUpdates: Partial<OrderRow> = {
        updated_at: now,
      };

      if (validated.notes !== undefined) {
        orderUpdates.notes = validated.notes;
      }

      if (validated.delivery_fee !== undefined) {
        orderUpdates.delivery_fee = validated.delivery_fee;
        orderUpdates.total = Math.max(0, order.subtotal - order.discount_amount + validated.delivery_fee);
      }

      const updated = await txOrderRepo.update(orderId, orderUpdates);

      await txAuditRepo.log('DELIVERY_INFO_UPDATED', 'order', orderId, user.id, {
        order_number: order.order_number,
        updates: validated,
      });

      return updated;
    });
  }
}
