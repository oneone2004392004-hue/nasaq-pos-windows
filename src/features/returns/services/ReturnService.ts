import { DatabaseManager } from '../../../database/DatabaseManager';
import { ReturnRepository } from '../../../repositories/ReturnRepository';
import { OrderRepository } from '../../../repositories/OrderRepository';
import { OrderItemRepository } from '../../../repositories/OrderItemRepository';
import { InvoiceRepository } from '../../../repositories/InvoiceRepository';
import { ProductRepository } from '../../../repositories/ProductRepository';
import { InventoryMovementRepository } from '../../../repositories/InventoryMovementRepository';
import { CashTransactionRepository } from '../../../repositories/CashTransactionRepository';
import { AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { ShiftRepository } from '../../../repositories/ShiftRepository';
import { AuthenticatedUser } from '../../auth/types';
import { ReturnRow, ReturnItemRow, OrderItemRow } from '../../../domain/dbModels';
import { requirePermission } from '../../auth/utils/permissions';
import { ConflictError, NotFoundError, ValidationError } from '../../../database/errors';
import { generateId } from '../../../utils/id';
import { ISqlExecutor } from '../../../database/contracts';

export interface ReturnItemInput {
  orderItemId?: string;
  /** Legacy callers may send productId only when invoice contains one matching line. */
  productId?: string;
  quantity: number;
  restock?: boolean;
}
export interface CreateReturnDTO {
  invoiceId: string;
  items: ReturnItemInput[];
  reason: string;
  refundMethod: 'CASH' | 'CARD';
  /** Required when cash refund exceeds ledger-derived shift cash. Requires returns.refund. */
  confirmCashOverdraw?: boolean;
}

function sumGross(items: OrderItemRow[]): number {
  return items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
}

/** Distributes merchandise net by gross line value and cumulative returned quantity. */
export function calculateMerchandiseRefund(
  netAmount: number,
  deliveryFee: number,
  grossLine: number,
  grossSubtotal: number,
  cumulativeQuantity: number,
  soldQuantity: number
): number {
  if (![netAmount, deliveryFee, grossLine, grossSubtotal, cumulativeQuantity, soldQuantity].every(Number.isSafeInteger)
    || netAmount < 0 || deliveryFee < 0 || grossLine < 0 || grossSubtotal <= 0
    || cumulativeQuantity < 0 || soldQuantity <= 0 || cumulativeQuantity > soldQuantity) {
    throw new ValidationError('بيانات توزيع المرتجع غير صالحة.');
  }
  const merchandisePool = Math.max(0, netAmount - deliveryFee);
  return Math.round(merchandisePool * grossLine * cumulativeQuantity / (grossSubtotal * soldQuantity));
}

interface MergedReturnItem {
  orderItemId: string;
  productId: string;
  quantity: number;
  restock: boolean;
}

export class ReturnService {
  public async create(user: AuthenticatedUser, input: CreateReturnDTO): Promise<ReturnRow> {
    const audit = new AuditLogRepository();
    requirePermission(user, 'returns.create', audit);
    if (input.refundMethod === 'CASH') requirePermission(user, 'returns.refund', audit);
    if (!input.reason.trim() || !input.items.length) throw new ValidationError('سبب المرتجع والأصناف المرتجعة مطلوبان.');

    return DatabaseManager.getInstance().transaction(async (tx) => {
      const invoices = new InvoiceRepository(tx);
      const orders = new OrderRepository(tx);
      const orderItemsRepo = new OrderItemRepository(tx);
      const returns = new ReturnRepository(tx);
      const products = new ProductRepository(tx);
      const movements = new InventoryMovementRepository(tx);
      const cash = new CashTransactionRepository(tx);
      const shifts = new ShiftRepository(tx);
      const txAudit = new AuditLogRepository(tx);
      const invoice = await invoices.findById(input.invoiceId);
      if (!invoice) throw new NotFoundError('الفاتورة', input.invoiceId);
      const order = await orders.findById(invoice.order_id);
      if (!order) throw new NotFoundError('الطلب', invoice.order_id);
      const soldItems = await orderItemsRepo.listByOrderId(order.id);
      if (!soldItems.length) throw new ValidationError('لا توجد أسطر أصناف في الفاتورة.');

      const soldById = new Map(soldItems.map((item) => [item.id, item]));
      const returnedQuantityByLine = new Map<string, number>();
      const returnedAmountByLine = new Map<string, number>();
      const previous = await returns.listByOriginalOrder(order.id);
      for (const oldReturn of previous) {
        for (const oldItem of await returns.getReturnItems(oldReturn.id)) {
          // Legacy rows were product-based and mapped to the first matching sale line.
          const legacyLine = oldItem.order_item_id
            ? soldById.get(oldItem.order_item_id)
            : soldItems.find((sold) => sold.product_id === oldItem.product_id);
          if (!legacyLine) continue;
          returnedQuantityByLine.set(legacyLine.id, (returnedQuantityByLine.get(legacyLine.id) || 0) + oldItem.quantity);
          returnedAmountByLine.set(legacyLine.id, (returnedAmountByLine.get(legacyLine.id) || 0) + oldItem.total);
        }
      }

      // Merge repeated requests for the same order-item line before validating sold quantity.
      const merged = new Map<string, MergedReturnItem>();
      for (const requested of input.items) {
        if (!Number.isSafeInteger(requested.quantity) || requested.quantity <= 0) {
          throw new ValidationError('كمية المرتجع يجب أن تكون رقماً صحيحاً أكبر من صفر.');
        }
        let sold: OrderItemRow | undefined;
        if (requested.orderItemId) {
          sold = soldById.get(requested.orderItemId);
        } else if (requested.productId) {
          const candidates = soldItems.filter((item) => item.product_id === requested.productId);
          if (candidates.length > 1) throw new ValidationError('الصنف مكرر في الفاتورة؛ حدد سطر الفاتورة المرتجع.');
          sold = candidates[0];
        }
        if (!sold) throw new ValidationError('سطر الصنف غير موجود في الفاتورة.');
        if (requested.productId && requested.productId !== sold.product_id) {
          throw new ValidationError('الصنف لا يطابق سطر الفاتورة المحدد.');
        }
        const prior = merged.get(sold.id);
        merged.set(sold.id, {
          orderItemId: sold.id,
          productId: sold.product_id,
          quantity: (prior?.quantity || 0) + requested.quantity,
          restock: (prior?.restock ?? true) && requested.restock !== false,
        });
      }

      const requestedRows = [...merged.values()].map((requested) => {
        const sold = soldById.get(requested.orderItemId)!;
        const already = returnedQuantityByLine.get(sold.id) || 0;
        if (already + requested.quantity > sold.quantity) {
          throw new ConflictError(`كمية المرتجع تتجاوز الكمية المباعة للصنف ${sold.product_name_snapshot}.`);
        }
        return { requested, sold, already };
      });
      const requestedByLine = new Map(requestedRows.map((row) => [row.sold.id, row.requested.quantity]));
      const allReturnedAfter = soldItems.every((sold) =>
        (returnedQuantityByLine.get(sold.id) || 0) + (requestedByLine.get(sold.id) || 0) >= sold.quantity
      );

      const grossSubtotal = sumGross(soldItems);
      if (!Number.isSafeInteger(invoice.net_amount) || !Number.isSafeInteger(order.delivery_fee)) {
        throw new ValidationError('مبالغ الفاتورة غير صحيحة؛ يجب أن تكون أعداداً صحيحة بالقروش.');
      }
      const returnId = generateId('ret');
      const returnNumber = await this.nextReturnNumber(tx);
      const now = new Date().toISOString();
      const currentShift = input.refundMethod === 'CASH' ? await shifts.findActiveShift(user.id) : null;
      if (input.refundMethod === 'CASH' && !currentShift) {
        throw new ValidationError('لا توجد وردية مفتوحة لهذا الكاشير لاستلام قيمة المرتجع. افتح وردية أولاً.');
      }
      const ledgerShiftId = currentShift?.id || order.shift_id;
      await tx.execute(
        `INSERT INTO returns (id, return_number, original_order_id, shift_id, original_shift_id, refund_method, total_refund_amount, reason, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [returnId, returnNumber, order.id, ledgerShiftId, order.shift_id, input.refundMethod, 0, input.reason.trim(), user.id, now]
      );

      const returnItems: ReturnItemRow[] = [];
      let total = 0;
      for (const row of requestedRows) {
        const grossLine = row.sold.unit_price * row.sold.quantity;
        const previousAmount = returnedAmountByLine.get(row.sold.id) || 0;
        const cumulativeQty = row.already + row.requested.quantity;
        const entitlement = calculateMerchandiseRefund(
          invoice.net_amount, order.delivery_fee, grossLine, grossSubtotal, cumulativeQty, row.sold.quantity
        );
        const itemTotal = Math.max(0, entitlement - previousAmount);
        const item: ReturnItemRow = {
          id: generateId('ritem'), return_id: returnId, order_item_id: row.sold.id,
          product_id: row.sold.product_id, product_name_snapshot: row.sold.product_name_snapshot,
          unit_price: row.sold.unit_price, quantity: row.requested.quantity,
          total: itemTotal, restock: row.requested.restock ? 1 : 0,
        };
        returnItems.push(item);
        total += itemTotal;
      }

      if (allReturnedAfter) {
        const alreadyTotal = previous.reduce((sum, item) => sum + item.total_refund_amount, 0);
        const residual = invoice.net_amount - alreadyTotal - total - order.delivery_fee;
        if (returnItems.length) {
          returnItems[returnItems.length - 1].total += residual;
          total += residual;
        }
        total += order.delivery_fee;
      }
      if (!Number.isSafeInteger(total) || total <= 0 || total > invoice.net_amount) {
        throw new ValidationError('قيمة المرتجع غير صالحة.');
      }

      if (input.refundMethod === 'CASH') {
        const ledger = await cash.calculateShiftCashTotals(ledgerShiftId);
        const expectedCash = currentShift!.opening_cash + ledger.netCash;
        if (!Number.isSafeInteger(expectedCash)) throw new ValidationError('رصيد الوردية النقدي غير صالح.');
        if (total > expectedCash) {
          if (input.confirmCashOverdraw !== true) {
            throw new ValidationError(`قيمة المرتجع تتجاوز النقدية المتوقعة في الوردية (${expectedCash} قرش). يلزم تأكيد مسؤول.`);
          }
          await txAudit.log('RETURN_CASH_OVERDRAW_CONFIRMED', 'return', returnId, user.id, {
            expected_cash: expectedCash, refund_amount: total, shift_id: ledgerShiftId,
          });
        }
      }

      for (const item of returnItems) {
        await tx.execute(
          `INSERT INTO return_items (id, return_id, order_item_id, product_id, product_name_snapshot, unit_price, quantity, total, restock)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [item.id, item.return_id, item.order_item_id || null, item.product_id, item.product_name_snapshot, item.unit_price, item.quantity, item.total, item.restock]
        );
        const product = await products.findById(item.product_id);
        if (product?.track_stock === 1 && item.restock === 1) {
          await products.updateStock(product.id, item.quantity);
          await movements.create({ id: generateId('mov'), product_id: product.id, movement_type: 'RETURN', quantity: item.quantity, reference_type: 'RETURN', reference_id: returnId, notes: input.reason.trim(), user_id: user.id, created_at: now });
        }
      }
      await tx.execute('UPDATE returns SET total_refund_amount = ? WHERE id = ?;', [total, returnId]);
      if (input.refundMethod === 'CASH') {
        await cash.create({ id: generateId('ctx'), shift_id: ledgerShiftId, transaction_type: 'REFUND', amount: total, reason: `مرتجع الفاتورة ${invoice.invoice_number}: ${input.reason.trim()}`, reference_id: returnId, user_id: user.id, created_at: now });
        const ledgerAfterRefund = await cash.calculateShiftCashTotals(ledgerShiftId);
        await shifts.updateExpectedCash(ledgerShiftId, currentShift!.opening_cash + ledgerAfterRefund.netCash);
      }
      const totalReturned = previous.reduce((sum, row) => sum + row.total_refund_amount, 0) + total;
      const full = totalReturned >= invoice.net_amount;
      await invoices.updateStatus(invoice.id, full ? 'REFUNDED' : 'PARTIALLY_REFUNDED');
      if (full) await orders.update(order.id, { status: 'RETURNED', updated_at: now });
      await txAudit.log('SALE_RETURN_CREATED', 'return', returnId, user.id, {
        invoice_id: invoice.id, return_number: returnNumber, total, full,
        refund_method: input.refundMethod, original_shift_id: order.shift_id,
        ledger_shift_id: ledgerShiftId, reason: input.reason.trim(),
      });
      return {
        id: returnId, return_number: returnNumber, original_order_id: order.id,
        shift_id: ledgerShiftId, original_shift_id: order.shift_id,
        refund_method: input.refundMethod, total_refund_amount: total,
        reason: input.reason.trim(), user_id: user.id, created_at: now,
      } as ReturnRow;
    });
  }

  private async nextReturnNumber(tx: ISqlExecutor): Promise<string> {
    const row = await tx.queryOne<{ next_number: number }>(
      "SELECT COALESCE(MAX(CAST(substr(return_number, 5) AS INTEGER)), 0) + 1 AS next_number FROM returns WHERE return_number LIKE 'RET-%';"
    );
    return `RET-${String(row?.next_number || 1).padStart(8, '0')}`;
  }
}
