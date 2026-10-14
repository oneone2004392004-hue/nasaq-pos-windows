import { InvoiceDesignConfig, InvoiceReceiptData, InvoiceTemplateMeta } from './types';

export const DEFAULT_INVOICE_DESIGN_CONFIG: InvoiceDesignConfig = {
  version: 1,
  templateId: 'classic',
  paperWidth: '80mm',

  // Identity
  storeName: 'مطعم نسق للمأكولات',
  storeAddress: 'القاهرة - جمهورية مصر العربية',
  storePhone: '01000000000',
  storePhone2: '01111111111',
  taxNumber: '345-678-901',
  commercialReg: '124589',

  // Header Visibility
  showStoreName: true,
  showAddress: true,
  showPhone: true,
  showPhone2: false,
  showTaxNumber: false,
  showCommercialReg: false,
  showInvoiceNumber: true,
  showOrderNumber: true,
  showDateTime: true,
  showCashier: true,
  showOrderType: true,

  // Order Details Visibility
  showTable: true,
  showCustomerName: true,
  showCustomerPhone: true,
  showDeliveryAddress: true,
  showDeliveryDriver: true,

  // Items Visibility
  showItemQuantity: true,
  showItemUnitPrice: true,
  showItemTotal: true,
  showItemBarcode: false,
  showItemNotes: true,

  // Totals Visibility
  showSubtotal: true,
  showDiscount: true,
  showTax: true,
  showDeliveryFee: true,

  // Payment Visibility
  showPaymentMethod: true,
  showAmountReceived: true,
  showChange: true,

  // Footer
  showFooter: true,
  footerText: 'شكراً لزيارتكم ونتمنى لكم وجبة شهية',
  showFooter2: true,
  footerText2: 'يرجى الاحتفاظ بالإيصال لخدمات ما بعد البيع',
};

export const SAMPLE_INVOICE_DATA: InvoiceReceiptData = {
  invoiceNumber: 'INV-20260912-0042',
  orderNumber: 'ORD-20260912-0089',
  orderType: 'DINE_IN',
  createdAt: '2026-09-12T14:35:00.000Z',
  cashierName: 'أحمد محمود',
  customerName: 'كريم الدسوقي',
  customerPhone: '01223456789',
  tableNumber: 'طاولة 07',
  deliveryAddress: 'المعادي - شارع 9 - برج النيل الدور 4',
  deliveryDriverName: 'محمود حسن',

  items: [
    {
      id: 'sample-item-1',
      name: 'وجبة شاورما دجاج عربي سوبر',
      quantity: 2,
      unitPrice: 11000, // 110.00 EGP
      total: 22000, // 220.00 EGP
      notes: 'ثومية إضافية - بدون مخلل',
      barcode: '6221000101',
    },
    {
      id: 'sample-item-2',
      name: 'ساندوتش كفتة مشوية على الفحم',
      quantity: 1,
      unitPrice: 7500, // 75.00 EGP
      total: 7500, // 75.00 EGP
      notes: 'طحينة إضافية',
      barcode: '6221000102',
    },
    {
      id: 'sample-item-3',
      name: 'بطاطس مقلية مع بهارات نسق',
      quantity: 2,
      unitPrice: 3500, // 35.00 EGP
      total: 7000, // 70.00 EGP
      barcode: '6221000103',
    },
    {
      id: 'sample-item-4',
      name: 'مشروب غازي كانز 330 مل',
      quantity: 3,
      unitPrice: 2000, // 20.00 EGP
      total: 6000, // 60.00 EGP
      barcode: '6221000104',
    },
  ],

  subtotal: 42500, // 425.00 EGP
  discountAmount: 2500, // 25.00 EGP
  taxAmount: 5600, // 56.00 EGP (14%)
  taxRate: 14,
  deliveryFee: 0, // 0 for DINE_IN
  total: 45600, // 456.00 EGP

  payments: [
    {
      id: 'sample-pmt-1',
      method: 'CASH',
      amount: 45600,
      tenderAmount: 50000, // 500.00 EGP
      changeAmount: 4400, // 44.00 EGP
    },
  ],

  printedCount: 1,
};

export const INVOICE_TEMPLATES_CATALOG: InvoiceTemplateMeta[] = [
  {
    id: 'classic',
    name: 'النمط الكلاسيكي',
    nameEn: 'Classic Thermal',
    description: 'التصميم القياسي المعتمد في معظم المطاعم. توازن مثالي بين الوضوح وفواصل الخطوط المتقطعة التقليدية.',
    badge: 'الأكثر شيوعاً',
    features: ['فواصل منقطة حرارية', 'جدول أصناف متوازن', 'تفاصيل مالية متسلسلة', 'مناسب لجميع الطابعات'],
  },
  {
    id: 'modern_minimal',
    name: 'العصري الهادئ',
    nameEn: 'Modern Minimal',
    description: 'طابع حديث بسيط بخطوط دقيقة ومساحات مريحة للعين، مع تركيز بصري على الإجمالي النهائي.',
    badge: 'عصري ومرتب',
    features: ['فواصل خطية ناعمة', 'مساحات بيضاء متناسقة', 'إجمالي كبير وبارز', 'مظهر نظيف وراقي'],
  },
  {
    id: 'compact_pos',
    name: 'الموجز السريع (توفير الورق)',
    nameEn: 'Compact POS',
    description: 'تصميم فائق الكثافة يوفر استهلاك الورق الحراري لأقصى درجة، مثالي للكافيهات ومنافذ الخدمة السريعة.',
    badge: 'توفير الورق 35%',
    features: ['ارتفاع إيصال مقتصد', 'دمج البيانات الأفقية', 'تقليل المسافات البينية', 'مثالي لورق 58mm و 80mm'],
  },
  {
    id: 'bold_restaurant',
    name: 'الهوية البارزة',
    nameEn: 'Bold Restaurant',
    description: 'تصميم عالي التباين بشريط علوي بارز وإطار قوي للإجمالي، يمنح الإيصال حضوراً قوياً وطابعاً فريداً.',
    badge: 'تباين عالي',
    features: ['شريط علوي أسود بارز', 'إطار محكم للإجمالي', 'شارة مميزة لنوع الطلب', 'طباعة أحادية حادة'],
  },
  {
    id: 'elegant',
    name: 'الفاخر المتناسق',
    nameEn: 'Fine Dining Elegant',
    description: 'تنسيق متناظر راقي مستوحى من المطاعم الفاخرة، بفواصل مزدوجة وعبارات ضيافة رصينة.',
    badge: 'مطاعم فاخرة',
    features: ['هرمية متناظرة متوسطة', 'فواصل مزدوجة أنيقة', 'تنسيق محاذي بدقة', 'خاتمة ترحيبية مهذبة'],
  },
];
