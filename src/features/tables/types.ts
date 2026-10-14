import { TableRow } from '../../domain/dbModels';
import { TableStatus } from '../../domain/enums';

export interface CreateTableDTO {
  name: string;
  capacity?: number;
  status?: TableStatus;
}

export interface UpdateTableDTO {
  name?: string;
  capacity?: number;
  status?: TableStatus;
  is_active?: number;
}

export interface TransferTableDTO {
  orderId: string;
  targetTableId?: string;
  targetTableNumber?: string;
}

export interface MergeTablesDTO {
  sourceOrderId: string;
  targetOrderId: string;
}

export interface TableWithCurrentOrderDTO extends TableRow {
  current_order_id: string | null;
  current_order_number: string | null;
  current_order_total: number | null; // minor units
  order_created_at: string | null;
}
