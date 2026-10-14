/**
 * NASAQ POS — Order Service (Phase 5 & 6)
 * Handles domain operations for creating, validating, updating, and managing Order Lifecycles.
 * Enforces RBAC permissions, integer financial integrity, product snapshots, and table conflicts.
 */

import { IOrderRepository, OrderRepository } from '../../../repositories/OrderRepository';
import { IOrderItemRepository, OrderItemRepository } from '../../../repositories/OrderItemRepository';
import { IProductRepository, ProductRepository } from '../../../repositories/ProductRepository';
import { ICustomerRepository, CustomerRepository } from '../../../repositories/CustomerRepository';
import { IShiftRepository, ShiftRepository } from '../../../repositories/ShiftRepository';
import { IAuditLogRepository, AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { TableRepository } from '../../../repositories/TableRepository';
import { DeliveryDriverRepository } from '../../../repositories/DeliveryDriverRepository';
import { AuthenticatedUser } from '../../auth/types';
import { requirePermission, requireAnyPermission } from '../../auth/utils/permissions';
import { OrderRow, OrderItemRow } from '../../../domain/dbModels';
import { OrderType, TableStatus } from '../../../domain/enums';
import { ValidationError, NotFoundError } from '../../../database/errors';
import { calculateLineTotal } from '../../../domain/cart';
import { CreateOrderDraftDTO, validateOrderDraft, validateUpdateOrderDraft } from '../validation';
import { OrderFilterParams, OrderListItemDTO, OrderDetailDTO, UpdateOrderDraftDTO } from '../types';
import { DatabaseManager } from '../../../database/DatabaseManager';
import { generateId } from '../../../utils/id';
import { SettingsRepository } from '../../../repositories/SettingsRepository';


export class OrderServiceCore {
  protected orderRepo: IOrderRepository;
  protected orderItemRepo: IOrderItemRepository;
  protected productRepo: IProductRepository;
  protected customerRepo: ICustomerRepository;
  protected shiftRepo: IShiftRepository;
  protected auditRepo: IAuditLogRepository;
  protected tableRepo: TableRepository;
  protected driverRepo: DeliveryDriverRepository;

  constructor(
    orderRepo?: IOrderRepository,
    orderItemRepo?: IOrderItemRepository,
    productRepo?: IProductRepository,
    customerRepo?: ICustomerRepository,
    shiftRepo?: IShiftRepository,
    auditRepo?: IAuditLogRepository,
    tableRepoOrDb?: TableRepository | DatabaseManager,
    driverRepo?: DeliveryDriverRepository,
    tableRepoArg?: TableRepository
  ) {
    this.orderRepo = orderRepo || new OrderRepository();
    this.orderItemRepo = orderItemRepo || new OrderItemRepository();
    this.productRepo = productRepo || new ProductRepository();
    this.customerRepo = customerRepo || new CustomerRepository();
    this.shiftRepo = shiftRepo || new ShiftRepository();
    this.auditRepo = auditRepo || new AuditLogRepository();

    if (tableRepoOrDb && 'execute' in tableRepoOrDb && !('findByName' in tableRepoOrDb)) {
      // 7th arg was db: DatabaseManager from previous phase tests
      this.tableRepo = tableRepoArg || new TableRepository();
      this.driverRepo = driverRepo || new DeliveryDriverRepository();
    } else {
      this.tableRepo = (tableRepoOrDb as TableRepository) || new TableRepository();
      this.driverRepo = driverRepo || new DeliveryDriverRepository();
    }
  }

  /**
   * Creates an Order Draft from the active POS Cart
   */
  public async createDraft(
    user: AuthenticatedUser,
    data: CreateOrderDraftDTO,
    executor?: import('../../../database/contracts').ISqlExecutor
  ): Promise<{ order: OrderRow; items: OrderItemRow[] }> {
    requirePermission(user, 'pos.create_order', this.auditRepo);
    const validated = validateOrderDraft(data);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const executeDraft = async (tx: import('../../../database/contracts').ISqlExecutor) => {
          const orderRepo = new OrderRepository(tx);
          const itemRepo = new OrderItemRepository(tx);
          const productRepo = new ProductRepository(tx);
          const customerRepo = new CustomerRepository(tx);
          const shiftRepo = new ShiftRepository(tx);
          const tableRepo = new TableRepository(tx);
          const auditRepo = new AuditLogRepository(tx);
          const settingsRepo = new SettingsRepository(tx);
          let tableId: string | null = validated.table_id || null;
          let tableNumber: string | null = validated.table_number || null;
          if (validated.order_type === OrderType.DINE_IN && (tableId || tableNumber)) {
            const lookup = tableId || tableNumber!;
            if (await orderRepo.findOccupiedTable(lookup)) throw new ValidationError(`طاولة [${tableNumber || lookup}] مشغولة حالياً بطلب معلق آخر.`);
            const table = tableId ? await tableRepo.findById(tableId) : await tableRepo.findByName(tableNumber!);
            if (table) {
              if (table.is_active !== 1) throw new ValidationError(`الطاولة (${table.name}) معطلة حالياً.`);
              tableId = table.id; tableNumber = table.name;
            }
          }
          const now = new Date().toISOString();
          const activeShift = await shiftRepo.findActiveShift(user.id);
          if (!activeShift) {
            throw new ValidationError('لا توجد وردية مفتوحة لهذا الكاشير. افتح وردية أولاً ثم أعد المحاولة.');
          }
          let customerId = validated.customer_id;
          if (!customerId && validated.customer_phone) {
            const existing = await customerRepo.findByPhone(validated.customer_phone);
            customerId = existing?.id;
            if (!customerId) {
              const customer = await customerRepo.create({
                id: generateId('cust'), name: validated.customer_name || `عميل ${validated.customer_phone}`,
                phone: validated.customer_phone, address: validated.customer_address, notes: null,
                created_at: now, updated_at: now,
              });
              customerId = customer.id;
            }
          }
          const orderId = generateId('ord');
          const orderItems: OrderItemRow[] = [];
          let subtotal = 0;
          for (const item of validated.items) {
            const product = await productRepo.findById(item.productId);
            if (!product) throw new ValidationError(`الصنف ذو المعرف "${item.productId}" غير موجود بالنظام`);
            if (product.is_active !== 1) throw new ValidationError(`الصنف "${product.name}" غير متاح حالياً للطلب`);
            const lineSubtotal = calculateLineTotal(item.quantity, product.price);
            subtotal += lineSubtotal;
            orderItems.push({ id: generateId('item'), order_id: orderId, product_id: product.id, product_name_snapshot: product.name, unit_price: product.price, quantity: item.quantity, subtotal: lineSubtotal, discount_amount: 0, total: lineSubtotal, notes: item.notes || null, created_at: now });
          }
          const deliveryFee = validated.delivery_fee;
          const discountType = validated.discount_type;
          const discountValue = validated.discount_value;
          const discountAmount = discountType === 'PERCENTAGE'
            ? Math.round(subtotal * discountValue / 100)
            : validated.discount_amount;
          if (discountAmount > subtotal) {
            throw new ValidationError('الخصم لا يمكن أن يتجاوز الإجمالي الفرعي للطلب.');
          }
          const taxEnabled = (await settingsRepo.get('tax_enabled')) === '1';
          const taxRate = taxEnabled ? Math.max(0, Number(await settingsRepo.get('default_tax_rate') || 0)) : 0;
          const taxInclusive = (await settingsRepo.get('tax_inclusive')) === '1';
          const taxableBase = Math.max(0, subtotal - discountAmount);
          const taxAmount = taxEnabled
            ? Math.round(taxInclusive ? taxableBase * taxRate / (100 + taxRate) : taxableBase * taxRate / 100)
            : 0;
          const total = Math.max(0, taxableBase + deliveryFee + (taxInclusive ? 0 : taxAmount));
          const savedOrder = await orderRepo.create({
            id: orderId, order_number: await orderRepo.getNextOrderNumber(), order_type: validated.order_type, status: 'PENDING',
            customer_id: customerId || null, table_id: tableId, table_number: tableNumber, delivery_driver_id: validated.delivery_driver_id || null,
            delivery_status: validated.delivery_status || (validated.order_type === OrderType.DELIVERY ? 'PENDING' : null), shift_id: activeShift.id, user_id: user.id, notes: validated.notes,
            subtotal, discount_type: discountType, discount_value: discountValue, discount_amount: discountAmount, tax_rate: taxRate, tax_amount: taxAmount, delivery_fee: deliveryFee, total, created_at: now, updated_at: now,
          });
          await itemRepo.addBatch(orderItems);
          if (tableId) await tableRepo.updateStatus(tableId, TableStatus.OCCUPIED);
          await auditRepo.log('ORDER_DRAFT_CREATED', 'order', savedOrder.id, user.id, { order_number: savedOrder.order_number, order_type: savedOrder.order_type, total_minor: savedOrder.total, items_count: orderItems.length, table_id: savedOrder.table_id, table_number: savedOrder.table_number, delivery_driver_id: savedOrder.delivery_driver_id, delivery_status: savedOrder.delivery_status, customer_id: savedOrder.customer_id });
          return { order: savedOrder, items: orderItems };
        };
        return await (executor ? executeDraft(executor) : DatabaseManager.getInstance().transaction(executeDraft));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/UNIQUE|unique|مكرر|constraint/i.test(message) || attempt === 2) throw error;
      }
    }
    throw new ValidationError('تعذر إنشاء رقم طلب فريد بعد عدة محاولات.');
  }

  /**
   * Retrieves an order and all its snapshot items
   */
  public async getOrderById(id: string): Promise<{ order: OrderRow; items: OrderItemRow[] }> {
    const order = await this.orderRepo.findById(id);
    if (!order) {
      throw new NotFoundError('Order', id);
    }
    const items = await this.orderItemRepo.listByOrderId(id);
    return { order, items };
  }

  /**
   * Retrieves order with joined cashier and customer details
   */
  public async getOrderWithDetails(user: AuthenticatedUser, id: string): Promise<OrderDetailDTO> {
    requireAnyPermission(user, ['orders.view', 'pos.view_menu', 'pos.create_order'], this.auditRepo);
    const order = await this.orderRepo.getOrderWithDetailsById(id);
    if (!order) {
      throw new NotFoundError('Order', id);
    }
    const items = await this.orderItemRepo.listByOrderId(id);
    return { order, items };
  }

  /**
   * Lists orders with filters (Phase 6 Orders Page)
   */
  public async listOrders(
    user: AuthenticatedUser,
    filters?: OrderFilterParams
  ): Promise<OrderListItemDTO[]> {
    requireAnyPermission(user, ['orders.view', 'pos.view_menu', 'pos.create_order'], this.auditRepo);
    return await this.orderRepo.listWithDetails(filters);
  }

  /**
   * Lists pending draft orders
   */
  public async listPendingDrafts(shiftId?: string): Promise<OrderRow[]> {
    if (shiftId) {
      const shiftOrders = await this.orderRepo.listByShift(shiftId);
      return shiftOrders.filter((o) => o.status === 'PENDING' || o.status === 'HOLD');
    }
    return await this.orderRepo.listByStatus('PENDING');
  }

  /**
   * Lists all occupied tables in Dine-In
   */
  public async listOccupiedTables(): Promise<{ table_number: string; order_id: string; total: number }[]> {
    return await this.orderRepo.listPendingDineInTables();
  }

  /**
   * Updates an existing PENDING order with atomic transaction and snapshot preservation.
   * Rule: Keeps existing snapshot price for unchanged/updated items; newly added items receive current catalog price.
   */
}
