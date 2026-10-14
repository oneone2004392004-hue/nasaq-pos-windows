import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/context/AuthContext';
import { ProductService } from '../../products/services/ProductService';
import { CategoryService } from '../../categories/services/CategoryService';
import { OrderService } from '../../orders/services/OrderService';
import { PaymentService, PaymentItemInput, CompleteSaleResult } from '../services/PaymentService';
import { BarcodeService, PrinterService, CashDrawerService } from '../../hardware';
import { ProductRow, CategoryRow } from '../../../domain/dbModels';
import { TableRepository } from '../../../repositories/TableRepository';
import { OrderType } from '../../../domain/enums';
import { usePOSCart } from '../hooks/usePOSCart';
import { useActiveShift } from '../../shifts/hooks/useActiveShift';
import { formatCurrency } from '../../../utils/formatters';
import { useToast } from '../../../components/ui/Toast';
import { errorMessage } from '../../../utils/errors';
import { logger } from '../../../utils/logger';
export const usePOSPageController = () => {
  const { user, hasPermission, lock } = useAuth();
  const { showToast } = useToast();
  // Catalog State
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  // Cart State (Phase 5 pure domain hook)
  const cart = usePOSCart();
  // Modals & Auxiliary State
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [occupiedTables, setOccupiedTables] = useState<
    { table_number: string; order_id: string; total: number }[]
  >([]);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Service singletons
  const productService = useMemo(() => new ProductService(), []);
  const categoryService = useMemo(() => new CategoryService(), []);
  const orderService = useMemo(() => new OrderService(), []);
  const paymentService = useMemo(() => new PaymentService(), []);
  const barcodeService = useMemo(() => new BarcodeService(), []);
  const printerService = useMemo(() => new PrinterService(), []);
  const cashDrawerService = useMemo(() => new CashDrawerService(), []);
  const tableRepo = useMemo(() => new TableRepository(), []);
  // Payment & Open Orders Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isOpenOrdersOpen, setIsOpenOrdersOpen] = useState<boolean>(false);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState<boolean>(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const { activeShift, refreshActiveShift } = useActiveShift();
  const [paymentOrder, setPaymentOrder] = useState<{
    id: string;
    order_number: string;
    total: number;
    subtotal: number;
    tax: number;
    discount: number;
    delivery_fee: number;
  } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlOrderId = searchParams.get('orderId');
  // Refresh occupied tables and pending orders count
  const refreshPendingCount = useCallback(async () => {
    if (!user) return;
    try {
      const [occupied, pendingList] = await Promise.all([
        orderService.listOccupiedTables(),
        orderService.listOrders(user, { status: 'PENDING' }),
      ]);
      setOccupiedTables(occupied);
      setPendingOrdersCount(pendingList.length);
    } catch (error) {
      logger.warn('Could not refresh pending POS order count', error);
    }
  }, [orderService, user]);
  // Load active catalog and occupied tables
  const loadCatalogData = useCallback(async () => {
    try {
      setLoadingCatalog(true);
      setCatalogError(null);
      const [loadedCats, loadedProds, tables, occupied, pendingList] = await Promise.all([
        categoryService.list(true),
        productService.getActiveProducts(),
        tableRepo.listAll(true),
        orderService.listOccupiedTables(),
        user ? orderService.listOrders(user, { status: 'PENDING' }) : Promise.resolve([]),
      ]);
      setCategories(loadedCats);
      setProducts(loadedProds);
      setTableNames(tables.map((table) => table.name));
      setOccupiedTables(occupied);
      setPendingOrdersCount(pendingList.length);
    } catch (err: unknown) {
      setCatalogError(errorMessage(err, 'تعذر تحميل بيانات نقطة البيع'));
    } finally {
      setLoadingCatalog(false);
    }
  }, [categoryService, productService, tableRepo, orderService, user]);
  useEffect(() => {
    loadCatalogData();
  }, [loadCatalogData]);
  // Resume / Load existing order into POS cart
  const handleOpenExistingOrder = useCallback(
    async (orderId: string, immediatePay = false) => {
      if (!user) return;
      try {
        const { order, items } = await orderService.getOrderWithDetails(user, orderId);
        if (order.status !== 'PENDING' && order.status !== 'HOLD') {
          setFeedbackMessage({
            type: 'error',
            text: `الطلب (${order.order_number}) ليس معلقاً وحالته [${order.status}]. لا يمكن تعديله.`,
          });
          return;
        }
        cart.loadExistingOrder({ order, items });
        setFeedbackMessage({
          type: 'success',
          text: `تم استدعاء الطلب (${order.order_number}) في الكاشير بنجاح.`,
        });
        if (immediatePay) {
          setPaymentOrder({
            id: order.id,
            order_number: order.order_number,
            total: order.total,
            subtotal: order.subtotal,
            tax: order.tax_amount,
            discount: order.discount_amount,
            delivery_fee: order.delivery_fee,
          });
          setIsPaymentModalOpen(true);
        }
      } catch (err: unknown) {
        setFeedbackMessage({
          type: 'error',
          text: errorMessage(err, 'تعذر تحميل بيانات الطلب المعلق'),
        });
      }
    },
    [user, orderService, cart]
  );
  // Load existing order for editing if orderId is in URL query parameters
  useEffect(() => {
    if (!urlOrderId || !user) return;
    handleOpenExistingOrder(urlOrderId);
  }, [urlOrderId, user, handleOpenExistingOrder]);
  // Comprehensive Cashier Keyboard Shortcuts (F1-F4, F9, F10, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        cart.setOrderType(
          cart.orderType === OrderType.TAKEAWAY
            ? OrderType.DINE_IN
            : cart.orderType === OrderType.DINE_IN
            ? OrderType.DELIVERY
            : OrderType.TAKEAWAY
        );
      } else if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setIsOpenOrdersOpen((prev) => !prev);
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.isOrderValid && !isSubmittingDraft) {
          void handleInitiatePayment();
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.isOrderValid && !isSubmittingDraft) {
          void handleSaveOrder(true);
        }
      } else if (e.key === 'F10' || e.key === 'F12') {
        e.preventDefault();
        lock();
      } else if (e.key === 'Escape') {
        if (isTableModalOpen) setIsTableModalOpen(false);
        if (isDeliveryModalOpen) setIsDeliveryModalOpen(false);
        if (isOpenOrdersOpen) setIsOpenOrdersOpen(false);
        if (isPaymentModalOpen) setIsPaymentModalOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isTableModalOpen,
    isDeliveryModalOpen,
    isOpenOrdersOpen,
    isPaymentModalOpen,
    cart,
    isSubmittingDraft,
    lock,
  ]);
  // Barcode / Name Instant Filter
  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCategoryId !== 'ALL') {
      list = list.filter((p) => p.category_id === selectedCategoryId);
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.barcode && p.barcode.toLowerCase().includes(query)) ||
          (p.sku && p.sku.toLowerCase().includes(query))
      );
    }
    return list;
  }, [products, selectedCategoryId, searchQuery]);
  // Fast Barcode Scanner handler (press Enter in search)
  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const term = searchQuery.trim();
      if (!term) return;
      // 1. Try BarcodeService resolution first
      const scanResult = await barcodeService.scan(term);
      if (scanResult.found && scanResult.product) {
        cart.addItem(scanResult.product);
        setSearchQuery('');
        setFeedbackMessage({
          type: 'success',
          text: `تمت إضافة (${scanResult.product.name}) إلى السلة بواسطة الباركود`,
        });
        return;
      }
      // 2. Check exact barcode in currently loaded products as fallback
      const exactBarcode = products.find(
        (p) => p.barcode && p.barcode.trim().toLowerCase() === term.toLowerCase()
      );
      if (exactBarcode) {
        cart.addItem(exactBarcode);
        setSearchQuery('');
        return;
      }
      // 3. If only 1 item matches search, add it directly
      if (filteredProducts.length === 1) {
        cart.addItem(filteredProducts[0]);
        setSearchQuery('');
        return;
      }
      // 4. If an invalid/unknown barcode was scanned, notify clearly
      if (scanResult.error && term.length >= 4 && /^\d+$/.test(term)) {
        setFeedbackMessage({
          type: 'error',
          text: scanResult.error,
        });
      }
    }
  };
  // Create or Update Order Draft submission (optionally send to kitchen)
  const handleSaveOrder = async (shouldPrintKitchen = false) => {
    if (!user) {
      setFeedbackMessage({ type: 'error', text: 'يجب تسجيل الدخول لتنفيذ هذه العملية' });
      return;
    }
    if (!cart.isOrderValid) {
      setFeedbackMessage({
        type: 'error',
        text: cart.orderValidationError || 'بيانات الطلب غير مكتملة',
      });
      return;
    }
    try {
      setIsSubmittingDraft(true);
      setFeedbackMessage(null);
      const payload = cart.getDraftPayload();
      let activeOrder;
      if (cart.editingOrderId) {
        // Update existing pending order (exact same ID and order_number!)
        const { order } = await orderService.updatePendingOrder(user, cart.editingOrderId, payload);
        activeOrder = order;
      } else {
        // Create new draft
        const { order } = await orderService.createDraft(user, payload);
        activeOrder = order;
      }
      // Kitchen Ticket Printing (non-blocking)
      if (shouldPrintKitchen || cart.orderType === OrderType.DINE_IN) {
        try {
          await printerService.printKitchenTicket(user, {
            orderNumber: activeOrder.order_number,
            orderType: activeOrder.order_type as OrderType,
            createdAt: activeOrder.created_at || new Date().toISOString(),
            cashierName: user.name,
            tableNumber: activeOrder.table_number || undefined,
            customerName: activeOrder.customer_name || undefined,
            customerPhone: activeOrder.customer_phone || undefined,
            deliveryAddress: activeOrder.customer_address || undefined,
            items: cart.items.map((it) => ({
              name: it.productName,
              quantity: it.quantity,
              notes: it.notes || undefined,
            })),
          });
        } catch (printErr) {
          console.warn('Kitchen ticket print note (non-blocking):', printErr);
        }
      }
      setFeedbackMessage({
        type: 'success',
        text: shouldPrintKitchen
          ? `تم حفظ الطلب (${activeOrder.order_number}) وإرسال تذكرة التجهيز للمطبخ بنجاح!`
          : `تم حفظ الطلب المعلق (${activeOrder.order_number}) بنجاح!`,
      });
      cart.clearCart();
      if (cart.editingOrderId) setSearchParams({});
      await refreshPendingCount();
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: errorMessage(err, 'حدث خطأ أثناء حفظ الطلب'),
      });
    } finally {
      setIsSubmittingDraft(false);
    }
  };
  // Initiate Payment & Open Modal
  const handleInitiatePayment = async () => {
    if (!user) {
      setFeedbackMessage({ type: 'error', text: 'يجب تسجيل الدخول لتنفيذ هذه العملية' });
      return;
    }
    if (!cart.isOrderValid) {
      setFeedbackMessage({
        type: 'error',
        text: cart.orderValidationError || 'بيانات الطلب غير مكتملة',
      });
      return;
    }
    if (!activeShift) {
      setFeedbackMessage({
        type: 'error',
        text: 'لا توجد وردية نقدية مفتوحة لك حالياً. يجب فتح وردية أولاً لإتمام عمليات السداد والتحصيل.',
      });
      setIsOpenShiftModalOpen(true);
      return;
    }
    try {
      setIsSubmittingDraft(true);
      setFeedbackMessage(null);
      const payload = cart.getDraftPayload();
      let result: CompleteSaleResult;
      if (cart.editingOrderId) {
        // Sync cart changes with database before payment
        const { order } = await orderService.updatePendingOrder(user, cart.editingOrderId, payload);
        const directPayments: PaymentItemInput[] = [{ method: 'CASH', amount: order.total, tenderAmount: order.total, referenceNumber: null }];
        result = await paymentService.completeSale(user, { orderId: order.id, payments: directPayments });
      } else {
        result = await paymentService.createAndPayOrder(user, orderService, payload, [{ method: 'CASH', amount: 0, tenderAmount: 0, referenceNumber: null }]);
      }
      // الدفع الرئيسي نقدي مباشر: ضغطة واحدة تسجل البيع وتطبع الإيصال.
      const payments = result.payments;
      try { await cashDrawerService.openDrawerOnPayment(user, payments); } catch (drawerErr) { console.warn('Cash drawer trigger note (non-blocking):', drawerErr); }
      try {
        await printerService.printCustomerReceipt(user, { invoice: result.invoice, order: result.order, items: result.items, payments: result.payments });
      } catch (printErr) {
        console.warn('Customer receipt print note (non-blocking):', printErr);
        showToast('تم تسجيل البيع، لكن تعذرت طباعة الإيصال. يمكنك إعادة طباعته من الفواتير.', 'error');
      }
      cart.clearCart();
      if (urlOrderId) setSearchParams({});
      setFeedbackMessage({ type: 'success', text: `تم الدفع وإصدار الفاتورة رقم ${result.invoice.invoice_number} وطباعة الإيصال.` });
      await refreshPendingCount();
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: errorMessage(err, 'حدث خطأ أثناء إعداد الطلب للسداد'),
      });
    } finally {
      setIsSubmittingDraft(false);
    }
  };
  const handlePaymentCompleteSale = async (payments: PaymentItemInput[]): Promise<CompleteSaleResult> => {
    if (!user || !paymentOrder) {
      throw new Error('بيانات المستخدم أو الطلب غير متوفرة');
    }
    const result = await paymentService.completeSale(user, {
      orderId: paymentOrder.id,
      payments,
    });
    // Hardware Integration: Open Cash Drawer if cash was tendered (non-blocking)
    try {
      await cashDrawerService.openDrawerOnPayment(user, payments);
    } catch (drawerErr) {
      console.warn('Cash drawer trigger note (non-blocking):', drawerErr);
    }
    // Hardware Integration: Print Customer Receipt (non-blocking)
    try {
      await printerService.printCustomerReceipt(user, {
        invoice: result.invoice,
        order: result.order,
        items: result.items,
        payments: result.payments,
      });
    } catch (printErr) {
      console.warn('Customer receipt print note (non-blocking):', printErr);
      showToast('تم تسجيل البيع، لكن تعذرت طباعة الإيصال. يمكنك إعادة طباعته من الفواتير.', 'error');
    }
    return result;
  };
  const handlePaymentSuccessDone = async () => {
    setIsPaymentModalOpen(false);
    setPaymentOrder(null);
    cart.clearCart();
    if (urlOrderId) setSearchParams({});
    setFeedbackMessage({
      type: 'success',
      text: 'تم إتمام عملية البيع وإصدار الفاتورة بنجاح!',
    });
    await refreshPendingCount();
  };
  // Quantity in cart lookup map
  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cart.items) {
      map.set(item.productId, item.quantity);
    }
    return map;
  }, [cart.items]);
  return {
    user,
    hasPermission,
    lock,
    showToast,
    categories,
    setCategories,
    products,
    setProducts,
    selectedCategoryId,
    setSelectedCategoryId,
    searchQuery,
    setSearchQuery,
    loadingCatalog,
    setLoadingCatalog,
    catalogError,
    setCatalogError,
    cart,
    isTableModalOpen,
    setIsTableModalOpen,
    isDeliveryModalOpen,
    setIsDeliveryModalOpen,
    tableNames,
    setTableNames,
    occupiedTables,
    setOccupiedTables,
    isSubmittingDraft,
    setIsSubmittingDraft,
    feedbackMessage,
    setFeedbackMessage,
    searchInputRef,
    productService,
    categoryService,
    orderService,
    paymentService,
    barcodeService,
    printerService,
    cashDrawerService,
    tableRepo,
    isPaymentModalOpen,
    setIsPaymentModalOpen,
    isOpenOrdersOpen,
    setIsOpenOrdersOpen,
    isOpenShiftModalOpen,
    setIsOpenShiftModalOpen,
    pendingOrdersCount,
    setPendingOrdersCount,
    activeShift,
    refreshActiveShift,
    paymentOrder,
    setPaymentOrder,
    searchParams,
    setSearchParams,
    urlOrderId,
    refreshPendingCount,
    loadCatalogData,
    handleOpenExistingOrder,
    filteredProducts,
    handleSearchKeyDown,
    handleSaveOrder,
    handleInitiatePayment,
    handlePaymentCompleteSale,
    handlePaymentSuccessDone,
    cartQtyMap
  };
};
export type POSPageController = ReturnType<typeof usePOSPageController>;
