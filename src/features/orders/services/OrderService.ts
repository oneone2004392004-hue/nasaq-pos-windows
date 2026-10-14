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

import { OrderServiceCore } from './OrderServiceCore';

export interface IOrderService {
  createDraft(user: AuthenticatedUser, data: CreateOrderDraftDTO, executor?: import('../../../database/contracts').ISqlExecutor): Promise<{ order: OrderRow; items: OrderItemRow[] }>;
  getOrderById(id: string): Promise<{ order: OrderRow; items: OrderItemRow[] }>;
  getOrderWithDetails(user: AuthenticatedUser, id: string): Promise<OrderDetailDTO>;
  listOrders(user: AuthenticatedUser, filters?: OrderFilterParams): Promise<OrderListItemDTO[]>;
  listPendingDrafts(shiftId?: string): Promise<OrderRow[]>;
  listOccupiedTables(): Promise<{ table_number: string; order_id: string; total: number }[]>;
  updatePendingOrder(user: AuthenticatedUser, orderId: string, data: UpdateOrderDraftDTO): Promise<{ order: OrderRow; items: OrderItemRow[] }>;
  cancelDraftOrder(user: AuthenticatedUser, orderId: string, reason?: string): Promise<OrderRow>;
}

export class OrderService extends OrderServiceCore implements IOrderService {
  public async updatePendingOrder(
    user: AuthenticatedUser,
    orderId: string,
    data: UpdateOrderDraftDTO
  ): Promise<{ order: OrderRow; items: OrderItemRow[] }> {
    // 1. RBAC Check: require orders.manage or pos.create_order
    requireAnyPermission(user, ['orders.manage', 'pos.create_order'], this.auditRepo);

    // 2. Fetch existing order
    const existingOrder = await this.orderRepo.findById(orderId);
    if (!existingOrder) {
      throw new NotFoundError('Order', orderId);
    }

    // 3. Status boundary: strictly PENDING or HOLD
    if (existingOrder.status !== 'PENDING' && existingOrder.status !== 'HOLD') {
      throw new ValidationError(
        `لا يمكن تعديل الطلب لأنه بحالة [${existingOrder.status}]. التعديل متاح فقط للطلبات المعلقة.`
      );
    }

    // 4. Validate DTO
    const validated = validateUpdateOrderDraft(data);

    // 5. Table conflict check (if Dine-In)
    let tableId: string | null = null;
    let tableNumber: string | null = null;

    if (validated.order_type === OrderType.DINE_IN) {
      if (validated.table_id) {
        tableId = validated.table_id;
      } else if (validated.table_number) {
        tableNumber = validated.table_number;
      } else {
        tableId = existingOrder.table_id || null;
        tableNumber = existingOrder.table_number || null;
      }

      const tableLookup = tableNumber || tableId;
      if (tableLookup) {
        const occupied = await this.orderRepo.findOccupiedTable(tableLookup, orderId);
        if (occupied) {
          throw new ValidationError(`طاولة [${tableNumber || tableLookup}] مشغولة حالياً بطلب معلق آخر.`);
        }

        if (tableId && !tableNumber) {
          const tbl = await this.tableRepo.findById(tableId);
          if (tbl) {
            if (tbl.is_active !== 1) throw new ValidationError(`الطاولة (${tbl.name}) معطلة حالياً.`);
            tableNumber = tbl.name;
          }
        } else if (tableNumber && !tableId) {
          const tbl = await this.tableRepo.findByName(tableNumber);
          if (tbl) {
            if (tbl.is_active !== 1) throw new ValidationError(`الطاولة (${tbl.name}) معطلة حالياً.`);
            tableId = tbl.id;
          }
        }
      }
    } else {
      tableId = null;
      tableNumber = null;
    }

    const deliveryDriverId = validated.delivery_driver_id !== undefined ? validated.delivery_driver_id : existingOrder.delivery_driver_id;
    const deliveryStatus = validated.delivery_status !== undefined ? validated.delivery_status : existingOrder.delivery_status;

    // 6. Delivery customer handling
    let customerId = validated.customer_id ?? existingOrder.customer_id;
    if (!customerId && validated.customer_phone) {
      const existingCust = await this.customerRepo.findByPhone(validated.customer_phone);
      if (existingCust) {
        customerId = existingCust.id;
      } else if (validated.customer_name || validated.customer_phone) {
        const newCust = await this.customerRepo.create({
          id: generateId('cust'),
          name: validated.customer_name || `عميل ${validated.customer_phone}`,
          phone: validated.customer_phone,
          address: validated.customer_address,
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        customerId = newCust.id;
      }
    }

    // 7. Snapshot preservation rule:
    // Items already present in this order retain their original snapshot price.
    // Newly added items receive the current catalog price.
    const existingItems = await this.orderItemRepo.listByOrderId(orderId);
    const existingItemMap = new Map<string, OrderItemRow>();
    for (const it of existingItems) {
      if (it.product_id) {
        existingItemMap.set(it.product_id, it);
      }
    }

    const now = new Date().toISOString();
    const newOrderItems: OrderItemRow[] = [];
    let subtotal = 0;

    for (const item of validated.items) {
      const product = await this.productRepo.findById(item.productId);
      if (!product) {
        throw new ValidationError(`الصنف ذو المعرف "${item.productId}" غير موجود بالنظام`);
      }

      if (product.is_active !== 1) {
        throw new ValidationError(`الصنف "${product.name}" غير متاح حالياً للطلب`);
      }

      let unitPrice = product.price;
      let snapshotName = product.name;

      // Preserve snapshot if already in this order
      if (existingItemMap.has(item.productId)) {
        const oldItem = existingItemMap.get(item.productId)!;
        unitPrice = oldItem.unit_price;
        snapshotName = oldItem.product_name_snapshot;
      }

      const lineSubtotal = calculateLineTotal(item.quantity, unitPrice);
      subtotal += lineSubtotal;

      newOrderItems.push({
        id: generateId('item'),
        order_id: orderId,
        product_id: product.id,
        product_name_snapshot: snapshotName,
        unit_price: unitPrice,
        quantity: item.quantity,
        subtotal: lineSubtotal,
        discount_amount: 0,
        total: lineSubtotal,
        notes: item.notes || null,
        created_at: now,
      });
    }

    const deliveryFee = validated.delivery_fee;
    const discountAmount = validated.discount_amount;
    const total = Math.max(0, subtotal + deliveryFee - discountAmount);

    // 8. ATOMIC TRANSACTION: update order and sync items
    await DatabaseManager.getInstance().transaction(async (tx) => {
      // Delete existing items
      await tx.run('DELETE FROM order_items WHERE order_id = ?;', [orderId]);

      // Insert new items
      for (const item of newOrderItems) {
        await tx.execute(
          `INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, unit_price, quantity, subtotal, discount_amount, total, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            item.id,
            item.order_id,
            item.product_id,
            item.product_name_snapshot,
            item.unit_price,
            item.quantity,
            item.subtotal,
            item.discount_amount,
            item.total,
            item.notes,
            item.created_at,
          ]
        );
      }

      // Update orders record
      await tx.execute(
        `UPDATE orders
         SET order_type = ?,
             customer_id = ?,
             table_id = ?,
             table_number = ?,
             delivery_driver_id = ?,
             delivery_status = ?,
             notes = ?,
             subtotal = ?,
             discount_value = ?,
             discount_amount = ?,
             delivery_fee = ?,
             total = ?,
             updated_at = ?
         WHERE id = ?;`,
        [
          validated.order_type,
          customerId,
          tableId,
          tableNumber,
          deliveryDriverId,
          deliveryStatus,
          validated.notes,
          subtotal,
          discountAmount,
          discountAmount,
          deliveryFee,
          total,
          now,
          orderId,
        ]
      );

      // Manage table occupancy transitions if table changed
      if (existingOrder.table_id && existingOrder.table_id !== tableId) {
        const otherOrder = await tx.queryOne(
          `SELECT id FROM orders WHERE (table_id = ? OR table_number = ?) AND status IN ('PENDING', 'HOLD') AND id != ? LIMIT 1;`,
          [existingOrder.table_id, existingOrder.table_number, orderId]
        );
        if (!otherOrder) {
          await tx.execute(`UPDATE tables SET status = 'AVAILABLE', updated_at = ? WHERE id = ?;`, [now, existingOrder.table_id]);
        }
      }
      if (tableId && tableId !== existingOrder.table_id) {
        await tx.execute(`UPDATE tables SET status = 'OCCUPIED', updated_at = ? WHERE id = ?;`, [now, tableId]);
      }
    });

    const updatedOrder = (await this.orderRepo.findById(orderId))!;

    // 9. Audit Log
    await this.auditRepo.log(
      'ORDER_UPDATED',
      'order',
      orderId,
      user.id,
      {
        order_number: updatedOrder.order_number,
        previous_total: existingOrder.total,
        new_total: total,
        items_count: newOrderItems.length,
        order_type: updatedOrder.order_type,
        table_id: updatedOrder.table_id,
        table_number: updatedOrder.table_number,
        delivery_driver_id: updatedOrder.delivery_driver_id,
        delivery_status: updatedOrder.delivery_status,
      }
    );

    return {
      order: updatedOrder,
      items: newOrderItems,
    };
  }

  /**
   * Cancels a pending draft order.
   * Releases table, sets status to CANCELLED, and logs audit.
   * Does NOT touch payments, invoices, or inventory.
   */
  public async cancelDraftOrder(
    user: AuthenticatedUser,
    orderId: string,
    reason?: string
  ): Promise<OrderRow> {
    requireAnyPermission(user, ['pos.cancel_order', 'orders.manage'], this.auditRepo);

    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order', orderId);
    }

    if (order.status === 'COMPLETED') {
      throw new ValidationError('لا يمكن إلغاء طلب مكتمل بالفعل. استخدم نظام المرتجعات.');
    }

    if (order.status === 'CANCELLED') {
      throw new ValidationError('الطلب ملغي بالفعل.');
    }

    const updated = await this.orderRepo.updateStatus(orderId, 'CANCELLED');

    // If delivery, also cancel delivery status
    if (order.order_type === 'DELIVERY') {
      await this.orderRepo.update(orderId, { delivery_status: 'CANCELLED' });
    }

    // If Dine-In table, release table if no other pending orders on it
    if (order.table_id || order.table_number) {
      const tableLookup = order.table_id || order.table_number;
      const otherOrder = await this.orderRepo.findOccupiedTable(tableLookup, orderId);
      if (!otherOrder) {
        if (order.table_id) {
          await this.tableRepo.updateStatus(order.table_id, TableStatus.AVAILABLE);
        } else if (order.table_number) {
          const tbl = await this.tableRepo.findByName(order.table_number);
          if (tbl) await this.tableRepo.updateStatus(tbl.id, TableStatus.AVAILABLE);
        }
      }
    }

    await this.auditRepo.log(
      'ORDER_CANCELLED',
      'order',
      orderId,
      user.id,
      {
        order_number: order.order_number,
        order_type: order.order_type,
        table_number: order.table_number,
        total_minor: order.total,
        reason: reason || 'إلغاء يدوي من الكاشير',
      }
    );

    return updated;
  }
}
