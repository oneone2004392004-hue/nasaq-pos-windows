import { DatabaseManager } from '../../../database/DatabaseManager';
import { TableRepository } from '../../../repositories/TableRepository';
import { OrderRepository } from '../../../repositories/OrderRepository';
import { OrderItemRepository } from '../../../repositories/OrderItemRepository';
import { AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { AuthenticatedUser } from '../../auth/types';
import { requirePermission, requireAnyPermission } from '../../auth/utils/permissions';
import { TableRow, OrderRow, OrderItemRow } from '../../../domain/dbModels';
import { TableStatus, OrderType } from '../../../domain/enums';
import { ValidationError, NotFoundError, ConflictError } from '../../../database/errors';
import { generateId } from '../../../utils/id';
import {
  CreateTableDTO,
  UpdateTableDTO,
  TransferTableDTO,
  MergeTablesDTO,
  TableWithCurrentOrderDTO,
} from '../types';
import {
  validateCreateTable,
  validateUpdateTable,
  validateTransferTable,
  validateMergeTables,
} from '../validation';

export interface ITableService {
  listTables(activeOnly?: boolean): Promise<TableRow[]>;
  listTablesWithCurrentOrder(activeOnly?: boolean): Promise<TableWithCurrentOrderDTO[]>;
  getTableById(id: string): Promise<TableRow>;
  getTableWithOrder(id: string): Promise<{ table: TableRow; order: OrderRow | null; items: OrderItemRow[] }>;
  createTable(user: AuthenticatedUser, data: CreateTableDTO): Promise<TableRow>;
  updateTable(user: AuthenticatedUser, id: string, data: UpdateTableDTO): Promise<TableRow>;
  deleteTable(user: AuthenticatedUser, id: string): Promise<boolean>;
  updateTableStatus(user: AuthenticatedUser, id: string, status: TableStatus): Promise<TableRow>;
  transferTable(
    user: AuthenticatedUser,
    dto: TransferTableDTO
  ): Promise<{ order: OrderRow; previousTable: TableRow | null; targetTable: TableRow }>;
  mergeTables(
    user: AuthenticatedUser,
    dto: MergeTablesDTO
  ): Promise<{ targetOrder: OrderRow; sourceOrder: OrderRow }>;
}

export class TableService implements ITableService {
  private dbManager: DatabaseManager;
  private tableRepo: TableRepository;
  private orderRepo: OrderRepository;
  private orderItemRepo: OrderItemRepository;
  private auditRepo: AuditLogRepository;

  constructor(
    dbManager?: DatabaseManager,
    tableRepo?: TableRepository,
    orderRepo?: OrderRepository,
    orderItemRepo?: OrderItemRepository,
    auditRepo?: AuditLogRepository
  ) {
    this.dbManager = dbManager || DatabaseManager.getInstance();
    this.tableRepo = tableRepo || new TableRepository();
    this.orderRepo = orderRepo || new OrderRepository();
    this.orderItemRepo = orderItemRepo || new OrderItemRepository();
    this.auditRepo = auditRepo || new AuditLogRepository();
  }

  public async listTables(activeOnly = false): Promise<TableRow[]> {
    return await this.tableRepo.listAll(activeOnly);
  }

  public async listTablesWithCurrentOrder(activeOnly = false): Promise<TableWithCurrentOrderDTO[]> {
    let sql = `
      SELECT 
        t.id,
        t.name,
        t.capacity,
        t.status,
        t.is_active,
        t.created_at,
        t.updated_at,
        o.id AS current_order_id,
        o.order_number AS current_order_number,
        o.total AS current_order_total,
        o.created_at AS order_created_at
      FROM tables t
      LEFT JOIN orders o ON (o.table_id = t.id OR o.table_number = t.name) 
                         AND o.status IN ('PENDING', 'HOLD')
    `;

    if (activeOnly) {
      sql += ' WHERE t.is_active = 1';
    }

    sql += ' ORDER BY t.name ASC;';

    const rows = await this.dbManager.query<TableWithCurrentOrderDTO>(sql);

    // Grouping / deduplicating by table id just in case multiple matches occur
    const map = new Map<string, TableWithCurrentOrderDTO>();
    for (const r of rows) {
      if (!map.has(r.id)) {
        // Compute effective status: if order exists, effective status is OCCUPIED
        const effectiveStatus = r.current_order_id ? TableStatus.OCCUPIED : r.status;
        map.set(r.id, {
          ...r,
          status: effectiveStatus,
        });
      }
    }

    return Array.from(map.values());
  }

  public async getTableById(id: string): Promise<TableRow> {
    const table = await this.tableRepo.findById(id);
    if (!table) {
      throw new NotFoundError('Table', id);
    }
    return table;
  }

  public async getTableWithOrder(
    id: string
  ): Promise<{ table: TableRow; order: OrderRow | null; items: OrderItemRow[] }> {
    const table = await this.getTableById(id);
    const order = await this.tableRepo.getOccupyingOrder(table.id);

    let items: OrderItemRow[] = [];
    if (order) {
      items = await this.orderItemRepo.listByOrderId(order.id);
    }

    return { table, order, items };
  }

  public async createTable(user: AuthenticatedUser, data: CreateTableDTO): Promise<TableRow> {
    requirePermission(user, 'tables.create', this.auditRepo);
    const validated = validateCreateTable(data);

    // Check unique name
    const existing = await this.tableRepo.findByName(validated.name);
    if (existing) {
      throw new ValidationError(`اسم الطاولة "${validated.name}" مسجل مسبقاً.`);
    }

    const now = new Date().toISOString();
    const newId = generateId('tbl');

    const newTable: TableRow = {
      id: newId,
      name: validated.name,
      capacity: validated.capacity,
      status: validated.status,
      is_active: 1,
      created_at: now,
      updated_at: now,
    };

    const saved = await this.tableRepo.create(newTable);

    await this.auditRepo.log('TABLE_CREATED', 'table', saved.id, user.id, {
      name: saved.name,
      capacity: saved.capacity,
      status: saved.status,
    });

    return saved;
  }

  public async updateTable(
    user: AuthenticatedUser,
    id: string,
    data: UpdateTableDTO
  ): Promise<TableRow> {
    requirePermission(user, 'tables.edit', this.auditRepo);
    const validated = validateUpdateTable(data);

    const table = await this.getTableById(id);

    // Check unique name if changing name
    if (validated.name && validated.name !== table.name) {
      const existing = await this.tableRepo.findByName(validated.name);
      if (existing && existing.id !== table.id) {
        throw new ValidationError(`اسم الطاولة "${validated.name}" مسجل مسبقاً.`);
      }
    }

    const now = new Date().toISOString();
    const updates: Partial<TableRow> = {
      ...validated,
      updated_at: now,
    };

    const updated = await this.tableRepo.update(id, updates);

    await this.auditRepo.log('TABLE_UPDATED', 'table', updated.id, user.id, {
      previous: { name: table.name, capacity: table.capacity, status: table.status, is_active: table.is_active },
      updated: updates,
    });

    return updated;
  }

  public async deleteTable(user: AuthenticatedUser, id: string): Promise<boolean> {
    requirePermission(user, 'tables.delete', this.auditRepo);
    const table = await this.getTableById(id);

    // Check active orders on table
    const occupying = await this.tableRepo.getOccupyingOrder(table.id);
    if (occupying) {
      throw new ConflictError(`لا يمكن حذف الطاولة (${table.name}) وهي مشغولة بطلب نشط حالياً (${occupying.order_number}).`);
    }

    const deleted = await this.tableRepo.safeDelete(id);

    if (deleted) {
      await this.auditRepo.log('TABLE_DELETED', 'table', id, user.id, {
        name: table.name,
      });
    }

    return deleted;
  }

  public async updateTableStatus(
    user: AuthenticatedUser,
    id: string,
    status: TableStatus
  ): Promise<TableRow> {
    requireAnyPermission(user, ['tables.edit', 'tables.transfer', 'pos.create_order'], this.auditRepo);

    const table = await this.getTableById(id);

    // If changing to AVAILABLE, ensure no active pending order is attached
    if (status === TableStatus.AVAILABLE) {
      const occupying = await this.tableRepo.getOccupyingOrder(table.id);
      if (occupying) {
        throw new ConflictError(
          `لا يمكن تحويل حالة الطاولة (${table.name}) إلى متاحة لوجود طلب معلق نشط (${occupying.order_number}) مرتبط بها.`
        );
      }
    }

    const updated = await this.tableRepo.updateStatus(id, status);

    await this.auditRepo.log('TABLE_STATUS_CHANGED', 'table', id, user.id, {
      table_name: table.name,
      previous_status: table.status,
      new_status: status,
    });

    return updated;
  }

  /**
   * Transfers an active Dine-In order to another table atomically with concurrency control.
   */
  public async transferTable(
    user: AuthenticatedUser,
    dto: TransferTableDTO
  ): Promise<{ order: OrderRow; previousTable: TableRow | null; targetTable: TableRow }> {
    requireAnyPermission(user, ['tables.transfer', 'orders.manage'], this.auditRepo);
    const validated = validateTransferTable(dto);

    return await this.dbManager.transaction(async (tx) => {
      const txOrderRepo = new OrderRepository(tx);
      const txTableRepo = new TableRepository(tx);
      const txAuditRepo = new AuditLogRepository(tx);

      // 1. Fetch and validate source order
      const order = await txOrderRepo.findById(validated.orderId);
      if (!order) {
        throw new NotFoundError('Order', validated.orderId);
      }

      if (order.order_type !== OrderType.DINE_IN) {
        throw new ValidationError('عملية نقل الطاولة متاحة فقط لطلبات الصالة (Dine-In).');
      }

      if (order.status !== 'PENDING' && order.status !== 'HOLD') {
        throw new ValidationError(`لا يمكن نقل طلب بحالة "${order.status}". يمكن نقل الطلبات المعلقة فقط.`);
      }

      // 2. Fetch and validate target table
      let targetTable: TableRow | null = null;
      if (validated.targetTableId) {
        targetTable = await txTableRepo.findById(validated.targetTableId);
      } else if (validated.targetTableNumber) {
        targetTable = await txTableRepo.findByName(validated.targetTableNumber);
      }

      if (!targetTable) {
        throw new NotFoundError('Table', validated.targetTableId || validated.targetTableNumber || '');
      }

      if (targetTable.is_active !== 1) {
        throw new ValidationError(`الطاولة (${targetTable.name}) معطلة حالياً.`);
      }

      // Check not transferring to same table
      if (
        (order.table_id && order.table_id === targetTable.id) ||
        (order.table_number && order.table_number === targetTable.name)
      ) {
        throw new ValidationError(`الطلب موجود بالفعل على الطاولة (${targetTable.name}).`);
      }

      // 3. Concurrency check: Ensure target table is NOT occupied by another active order
      const occupying = await txTableRepo.getOccupyingOrder(targetTable.id);
      if (occupying && occupying.id !== order.id) {
        throw new ConflictError(
          `الطاولة المراد النقل إليها (${targetTable.name}) مشغولة حالياً بالطلب (${occupying.order_number}).`
        );
      }

      // 4. Resolve previous table if existing
      let previousTable: TableRow | null = null;
      if (order.table_id) {
        previousTable = await txTableRepo.findById(order.table_id);
      } else if (order.table_number) {
        previousTable = await txTableRepo.findByName(order.table_number);
      }

      const now = new Date().toISOString();

      // 5. Release previous table to AVAILABLE (if no other pending order)
      if (previousTable) {
        const otherOrder = await tx.queryOne(
          `SELECT id FROM orders WHERE (table_id = ? OR table_number = ?) AND status IN ('PENDING', 'HOLD') AND id != ? LIMIT 1;`,
          [previousTable.id, previousTable.name, order.id]
        );
        if (!otherOrder) {
          await txTableRepo.updateStatus(previousTable.id, TableStatus.AVAILABLE);
        }
      }

      // 6. Mark target table as OCCUPIED
      const updatedTargetTable = await txTableRepo.updateStatus(targetTable.id, TableStatus.OCCUPIED);

      // 7. Update order record
      const updatedOrder = await txOrderRepo.update(order.id, {
        table_id: targetTable.id,
        table_number: targetTable.name,
        updated_at: now,
      });

      // 8. Audit log
      await txAuditRepo.log('TABLE_TRANSFERRED', 'table', targetTable.id, user.id, {
        order_id: order.id,
        order_number: order.order_number,
        from_table_id: previousTable?.id || null,
        from_table_name: previousTable?.name || order.table_number,
        to_table_id: targetTable.id,
        to_table_name: targetTable.name,
      });

      return {
        order: updatedOrder,
        previousTable,
        targetTable: updatedTargetTable,
      };
    });
  }

  /**
   * Merges two active Dine-In orders into a single order.
   * Source order items are moved into Target order, totals recalculated, and source table released.
   */
  public async mergeTables(
    user: AuthenticatedUser,
    dto: MergeTablesDTO
  ): Promise<{ targetOrder: OrderRow; sourceOrder: OrderRow }> {
    requireAnyPermission(user, ['tables.transfer', 'orders.manage'], this.auditRepo);
    const validated = validateMergeTables(dto);

    return await this.dbManager.transaction(async (tx) => {
      const txOrderRepo = new OrderRepository(tx);
      const txOrderItemRepo = new OrderItemRepository(tx);
      const txTableRepo = new TableRepository(tx);
      const txAuditRepo = new AuditLogRepository(tx);

      // 1. Fetch both orders
      const sourceOrder = await txOrderRepo.findById(validated.sourceOrderId);
      if (!sourceOrder) throw new NotFoundError('Order', validated.sourceOrderId);

      const targetOrder = await txOrderRepo.findById(validated.targetOrderId);
      if (!targetOrder) throw new NotFoundError('Order', validated.targetOrderId);

      if (sourceOrder.status !== 'PENDING' && sourceOrder.status !== 'HOLD') {
        throw new ValidationError(`لا يمكن دمج طلب مصدر بحالة "${sourceOrder.status}".`);
      }
      if (targetOrder.status !== 'PENDING' && targetOrder.status !== 'HOLD') {
        throw new ValidationError(`لا يمكن دمج طلب هدف بحالة "${targetOrder.status}".`);
      }

      // 2. Fetch source order items
      const sourceItems = await txOrderItemRepo.listByOrderId(sourceOrder.id);
      if (sourceItems.length === 0) {
        throw new ValidationError('الطلب المصدر لا يحتوي على أي أصناف لدمجها.');
      }

      const now = new Date().toISOString();

      // 3. Move items to target order with new IDs to preserve line item history
      for (const item of sourceItems) {
        const newItemId = generateId('item');
        await tx.execute(
          `INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, unit_price, quantity, subtotal, discount_amount, total, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            newItemId,
            targetOrder.id,
            item.product_id,
            item.product_name_snapshot,
            item.unit_price,
            item.quantity,
            item.subtotal,
            item.discount_amount,
            item.total,
            item.notes ? `${item.notes} (مدمج من ${sourceOrder.order_number})` : `مدمج من ${sourceOrder.order_number}`,
            now,
          ]
        );
      }

      // 4. Recalculate target order totals
      const allTargetItems = await txOrderItemRepo.listByOrderId(targetOrder.id);
      const newSubtotal = allTargetItems.reduce((acc, it) => acc + it.total, 0);
      const newTotal = Math.max(0, newSubtotal - targetOrder.discount_amount + targetOrder.delivery_fee);

      const updatedTargetOrder = await txOrderRepo.update(targetOrder.id, {
        subtotal: newSubtotal,
        total: newTotal,
        notes: targetOrder.notes
          ? `${targetOrder.notes} | دمج مع طلب #${sourceOrder.order_number}`
          : `دمج مع طلب #${sourceOrder.order_number}`,
        updated_at: now,
      });

      // 5. Cancel source order
      const updatedSourceOrder = await txOrderRepo.update(sourceOrder.id, {
        status: 'CANCELLED',
        notes: `تم دمج الطلب مع الطلب #${targetOrder.order_number}`,
        updated_at: now,
      });

      // 6. Release source table if no other pending orders
      if (sourceOrder.table_id || sourceOrder.table_number) {
        const sourceTableTarget = sourceOrder.table_id || sourceOrder.table_number;
        const otherOrder = await tx.queryOne(
          `SELECT id FROM orders WHERE (table_id = ? OR table_number = ?) AND status IN ('PENDING', 'HOLD') AND id != ? LIMIT 1;`,
          [sourceTableTarget, sourceTableTarget, sourceOrder.id]
        );
        if (!otherOrder) {
          if (sourceOrder.table_id) {
            await txTableRepo.updateStatus(sourceOrder.table_id, TableStatus.AVAILABLE);
          } else if (sourceOrder.table_number) {
            const tbl = await txTableRepo.findByName(sourceOrder.table_number);
            if (tbl) await txTableRepo.updateStatus(tbl.id, TableStatus.AVAILABLE);
          }
        }
      }

      // 7. Audit log
      await txAuditRepo.log('TABLES_MERGED', 'order', targetOrder.id, user.id, {
        target_order_id: targetOrder.id,
        target_order_number: targetOrder.order_number,
        source_order_id: sourceOrder.id,
        source_order_number: sourceOrder.order_number,
        new_total: newTotal,
      });

      return {
        targetOrder: updatedTargetOrder,
        sourceOrder: updatedSourceOrder,
      };
    });
  }
}
