import React from 'react';
import type { POSPageController } from '../hooks/usePOSPageController';
import { TableSelectorModal } from './TableSelectorModal';
import { DeliveryCustomerModal } from './DeliveryCustomerModal';
import { PaymentModal } from './PaymentModal';
import { OpenOrdersModal } from './OpenOrdersModal';
import { OpenShiftModal } from '../../shifts/components/OpenShiftModal';


interface Props { controller: POSPageController; }

export const POSPageDialogs: React.FC<Props> = ({ controller }) => (
  <React.Fragment>
      <TableSelectorModal
        isOpen={controller.isTableModalOpen}
        onClose={() => controller.setIsTableModalOpen(false)}
        selectedTable={controller.cart.selectedTable}
        onSelectTable={controller.cart.setSelectedTable}
        occupiedTables={controller.occupiedTables}
        tableNames={controller.tableNames}
        onOpenOccupiedOrder={(orderId) => {
          controller.setIsTableModalOpen(false);
          controller.handleOpenExistingOrder(orderId);
        }}
      />

      <OpenOrdersModal
        isOpen={controller.isOpenOrdersOpen}
        onClose={() => {
          controller.setIsOpenOrdersOpen(false);
          controller.refreshPendingCount();
        }}
        onSelectOrder={controller.handleOpenExistingOrder}
      />

      <DeliveryCustomerModal
        isOpen={controller.isDeliveryModalOpen}
        onClose={() => controller.setIsDeliveryModalOpen(false)}
        currentCustomer={controller.cart.deliveryCustomer}
        currentDeliveryFeeMinor={controller.cart.deliveryFee}
        onSave={(cust, feeMinor) => {
          controller.cart.setDeliveryCustomer(cust);
          controller.cart.setDeliveryFee(feeMinor);
        }}
      />

      {controller.paymentOrder && (
        <PaymentModal
          isOpen={controller.isPaymentModalOpen}
          onClose={() => controller.setIsPaymentModalOpen(false)}
          orderId={controller.paymentOrder.id}
          orderNumber={controller.paymentOrder.order_number}
          totalMinor={controller.paymentOrder.total}
          subtotalMinor={controller.paymentOrder.subtotal}
          taxMinor={controller.paymentOrder.tax}
          discountMinor={controller.paymentOrder.discount}
          deliveryFeeMinor={controller.paymentOrder.delivery_fee}
          onCompleteSale={controller.handlePaymentCompleteSale}
          onSuccessDone={controller.handlePaymentSuccessDone}
        />
      )}

      <OpenShiftModal
        isOpen={controller.isOpenShiftModalOpen}
        onClose={() => controller.setIsOpenShiftModalOpen(false)}
        onShiftOpened={controller.refreshActiveShift}
      />

  </React.Fragment>
);
