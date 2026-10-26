// Strict Rule A: ONLY these 5 Stock Bucket Names Everywhere
export type StockBucketName =
  | 'Available'
  | 'Reserved'
  | 'On the Van'
  | 'Pending Return'
  | 'Damaged';

export type StockBuckets = {
  Available: number;
  Reserved: number;
  'On the Van': number;
  'Pending Return': number;
  Damaged: number;
};

// Rule B: B2B Shop Categories
export type ShopCategory =
  | 'Regular Trusted Shop'
  | 'New Shop'
  | 'Shop with Past Refusal/Cancellation'
  | 'Credit Shop';

// Rule D: 5 Roles in the system
export type UserRole =
  | 'Sales Officer (Bole Office)'
  | 'Accountant / Finance'
  | 'Storekeeper (Kality Warehouse)'
  | 'Delivery Driver (Mobile Phone View)'
  | 'Owner / Manager';

export type VoucherType = 'GRN' | 'SIV' | 'SRN' | 'ADJ' | 'ORDER_RESERVE' | 'DELIVERY_POD';

export type PaymentChannel =
  | 'Telebirr'
  | 'CBE Birr'
  | 'CBE Mobile Banking'
  | 'Awash / Dashen via EthSwitch'
  | 'Cash on Delivery';

export interface ProductBatch {
  batchId: string;
  lotNumber: string;
  sku: string;
  expiryDate: string; // YYYY-MM-DD
  daysUntilExpiry: number;
  binCode: string; // e.g., KAL-Z1-A01-B01
  buckets: StockBuckets;
  deliveredAndSoldCartons: number; // Completed delivery outcome metric (outside warehouse stock count)
}

export interface Product {
  sku: string;
  nameEn: string;
  nameAm: string;
  category: string;
  piecesPerCarton: number;
  unitLabelEn: string; // e.g., "4 Jerrycans", "12 Packs"
  unitLabelAm: string;
  pricePerCartonEtb: number;
  defaultBinCode: string;
  batches: ProductBatch[];
}

export interface ShopProfile {
  shopId: string;
  nameEn: string;
  nameAm: string;
  subCity: string;
  contactPerson: string;
  phoneMasked: string; // NFR-05 protected
  phoneFull: string;
  shopCategory: ShopCategory;
  creditLimitEtb: number;
  currentBalanceEtb: number;
  requiredDepositPct: number; // Configurable by Manager (e.g., 15% or 20%)
  pastRefusalCount: number;
  completedOrdersCount: number;
  gpsLat: number;
  gpsLng: number;
  landmarkNote: string;
}

export interface OrderLineItem {
  sku: string;
  productNameEn: string;
  productNameAm: string;
  cartons: number;
  loosePieces: number;
  pricePerCartonEtb: number;
  lineTotalEtb: number;
  allocatedBatches: {
    batchId: string;
    lotNumber: string;
    binCode: string;
    expiryDate: string;
    cartonsAllocated: number;
  }[];
}

export type OrderStatus =
  | 'Awaiting Deposit Approval'
  | 'Confirmed'
  | 'On the Van (SIV Issued)'
  | 'Delivered & Settled'
  | 'Partially Delivered (Pending Return)';

export interfaceLinksEtVerificationPayload {
  verified: boolean;
  referenceNumber: string;
  payerName: string;
  amountEtb: number;
  provider: PaymentChannel;
  verifiedAtIso: string;
  transactionStatus: 'COMPLETED' | 'PENDING' | 'INVALID';
  endpointUsed: string;
  mode: 'LIVE_FETCH' | 'SIMULATED_FALLBACK';
}

export interface ShopOrder {
  orderId: string;
  createdAt: string;
  shopId: string;
  shopNameEn: string;
  shopNameAm: string;
  shopCategory: ShopCategory;
  gpsLat: number;
  gpsLng: number;
  items: OrderLineItem[];
  totalAmountEtb: number;
  requiredDepositPct: number;
  requiredDepositEtb: number;
  depositReferenceNumber: string;
  depositPaymentChannel: PaymentChannel;
  depositVerifiedViaLinksEt: boolean;
  depositApprovedByAccountant: boolean;
  linksEtResponse?: interfaceLinksEtVerificationPayload;
  status: OrderStatus;
  commitmentReason: string;
  sivVoucherId?: string;
  assignedTripId?: string;
}

export interface InboundPurchaseOrder {
  poId: string;
  supplierName: string;
  truckPlate: string;
  arrivedAt: string;
  sku: string;
  productNameEn: string;
  productNameAm: string;
  piecesPerCarton: number;
  expectedCartons: number; // Hidden during blind count!
  expectedLoosePieces: number;
  suggestedBinCode: string;
  status: 'Waiting for Blind Count' | 'GRN Completed';
  grnVoucherId?: string;
  recordedGoodCartons?: number;
  recordedLoosePieces?: number;
  recordedDamagedCartons?: number;
  recordedLotNumber?: string;
  recordedExpiryDate?: string;
}

export interface DeliveryStopItem {
  sku: string;
  productNameEn: string;
  productNameAm: string;
  lotNumber: string;
  batchId: string;
  loadedCartons: number;
  acceptedCartons: number;
  rejectedCartons: number;
  rejectionReason?: string;
  pricePerCartonEtb: number;
}

export interface DeliveryTrip {
  tripId: string;
  sivVoucherId: string;
  orderId: string;
  driverName: string;
  driverPhone: string;
  vanPlate: string;
  dispatchedAt: string;
  shopId: string;
  shopNameEn: string;
  shopNameAm: string;
  shopPhoneMasked: string;
  shopPhoneFull: string;
  gpsLat: number;
  gpsLng: number;
  landmarkNote: string;
  items: DeliveryStopItem[];
  totalLoadedValueEtb: number;
  acceptedValueEtb: number;
  depositAlreadyPaidEtb: number;
  balanceCollectedEtb: number;
  paymentMethod: PaymentChannel;
  paymentReferenceNumber: string;
  paymentVerifiedViaLinksEt: boolean;
  customerSignatureName: string;
  stopStatus:
    | 'Out for Delivery'
    | 'Delivered (Full)'
    | 'Partial Delivery — Pending Return Gate Lock'
    | 'Gate-In SRN Completed & Unlocked';
  tripClosed: boolean;
  tripLockedReason?: string;
  srnVoucherId?: string;
  settledByAccountant: boolean;
  settledAt?: string;
}

export interface OfflineSyncQueueItem {
  queueId: string;
  createdAt: string;
  tripId: string;
  shopNameEn: string;
  actionType: 'FULL_DELIVERY' | 'PARTIAL_DELIVERY';
  acceptedCartonsTotal: number;
  rejectedCartonsTotal: number;
  rejectionReason?: string;
  paymentChannel: PaymentChannel;
  paymentReferenceNumber: string;
  amountCollectedEtb: number;
  signatureName: string;
  itemBreakdowns: {
    sku: string;
    batchId: string;
    acceptedCartons: number;
    rejectedCartons: number;
  }[];
  synced: boolean;
}

export interface BinCardEntry {
  entryId: string;
  timestamp: string;
  actorRole: UserRole;
  actorName: string;
  voucherType: VoucherType;
  voucherId: string;
  sku: string;
  productNameEn: string;
  batchId: string;
  lotNumber: string;
  actionSummary: string;
  beforeBuckets: StockBuckets;
  afterBuckets: StockBuckets;
  beforeDeliveredSold: number;
  afterDeliveredSold: number;
}

export interface PrintableVoucher {
  voucherId: string;
  voucherType: 'GRN' | 'SIV' | 'SRN' | 'ADJ';
  createdAt: string;
  createdByRole: UserRole;
  counterpartyName: string;
  referenceDocId: string; // PO ID, Order ID, Trip ID, or Cycle Count ID
  notes: string;
  lines: {
    sku: string;
    productNameEn: string;
    productNameAm: string;
    lotNumber: string;
    expiryDate: string;
    binCode: string;
    cartons: number;
    loosePieces?: number;
    damagedOrRejectedCartons?: number;
    fromBucket: string;
    toBucket: string;
    unitValueEtb: number;
  }[];
}

export interface BlindCycleCountRecord {
  countId: string;
  timestamp: string;
  sku: string;
  batchId: string;
  lotNumber: string;
  binCode: string;
  countedCartons: number;
  countedLoosePieces: number;
  expectedAvailableCartons: number; // Revealed only AFTER submission
  varianceCartons: number;
  countedBy: string;
  status: 'Matched' | 'Variance Flagged for Manager';
}

export interface ApiIntegrationConfig {
  linksEtEndpointUrl: string;
  linksEtApiKey: string;
  defaultPaymentProvider: PaymentChannel;
  googleMapsApiKey: string;
}

export interface HubState {
  language: 'en' | 'am';
  currentRole: UserRole;
  driverOnline: boolean;
  driverPhoneFrameMode: boolean;
  apiConfig: ApiIntegrationConfig;
  products: Product[];
  shops: ShopProfile[];
  purchaseOrders: InboundPurchaseOrder[];
  orders: ShopOrder[];
  trips: DeliveryTrip[];
  offlineQueue: OfflineSyncQueueItem[];
  binCardLog: BinCardEntry[];
  vouchers: PrintableVoucher[];
  cycleCounts: BlindCycleCountRecord[];
}
