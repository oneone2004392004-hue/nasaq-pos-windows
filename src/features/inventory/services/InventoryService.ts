import { DatabaseManager } from '../../../database/DatabaseManager';
import { ProductRepository } from '../../../repositories/ProductRepository';
import { InventoryMovementRepository } from '../../../repositories/InventoryMovementRepository';
import { AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { SettingsRepository } from '../../../repositories/SettingsRepository';
import { AuthenticatedUser } from '../../auth/types';
import { ProductRow, InventoryMovementRow } from '../../../domain/dbModels';
import { requirePermission } from '../../auth/utils/permissions';
import { ConflictError, ValidationError, NotFoundError } from '../../../database/errors';
import { generateId } from '../../../utils/id';

export class InventoryService {
  public async list(user: AuthenticatedUser, search = ''): Promise<ProductRow[]> {
    requirePermission(user, 'inventory.view', new AuditLogRepository());
    return new ProductRepository().listWithFilter({ isActive: true, search });
  }

  public async listMovements(user: AuthenticatedUser, limit = 50): Promise<InventoryMovementRow[]> {
    requirePermission(user, 'inventory.view', new AuditLogRepository());
    return new InventoryMovementRepository().listRecent(limit);
  }

  public async adjust(user: AuthenticatedUser, productId: string, delta: number, reason: string): Promise<ProductRow> {
    requirePermission(user, 'inventory.adjust', new AuditLogRepository());
    if (!Number.isInteger(delta) || delta === 0) throw new ValidationError('كمية التسوية يجب أن تكون رقماً صحيحاً غير صفر.');
    if (!reason.trim()) throw new ValidationError('سبب التسوية إلزامي.');
    return DatabaseManager.getInstance().transaction(async (tx) => {
      const products = new ProductRepository(tx);
      const movements = new InventoryMovementRepository(tx);
      const audit = new AuditLogRepository(tx);
      const settings = new SettingsRepository(tx);
      const product = await products.findById(productId);
      if (!product) throw new NotFoundError('الصنف', productId);
      if (!product.track_stock) throw new ValidationError('هذا الصنف غير متتبع في المخزون.');
      const allowNegative = (await settings.get('allow_negative_stock')) === '1';
      if (!allowNegative && product.current_stock + delta < 0) throw new ConflictError('التسوية ستجعل رصيد المخزون سالباً.');
      await products.updateStock(productId, delta);
      await movements.create({ id: generateId('mov'), product_id: productId, movement_type: 'ADJUSTMENT', quantity: Math.abs(delta), reference_type: 'MANUAL', reference_id: null, notes: reason.trim(), user_id: user.id, created_at: new Date().toISOString() });
      const updated = await products.findById(productId);
      if (!updated) throw new NotFoundError('الصنف', productId);
      await audit.log('INVENTORY_ADJUSTED', 'product', productId, user.id, { delta, reason: reason.trim(), before: product.current_stock, after: updated.current_stock });
      return updated;
    });
  }
}
