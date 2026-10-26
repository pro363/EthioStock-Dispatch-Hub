import {
  BinCardEntry,
  BlindCycleCountRecord,
  DeliveryTrip,
  HubState,
  OrderLineItem,
  PaymentChannel,
  PrintableVoucher,
  Product,
  ProductBatch,
  ShopOrder,
  ShopProfile,
  StockBuckets,
  UserRole,
  interfaceLinksEtVerificationPayload,
} from '../types/domain';

export function cloneBuckets(b: StockBuckets): StockBuckets {
  return {
    Available: b.Available,
    Reserved: b.Reserved,
    'On the Van': b['On the Van'],
    'Pending Return': b['Pending Return'],
    Damaged: b.Damaged,
  };
}

export function getProductStockSummary(product: Product): StockBuckets & { deliveredAndSold: number } {
  const total: StockBuckets & { deliveredAndSold: number } = {
    Available: 0,
    Reserved: 0,
    'On the Van': 0,
    'Pending Return': 0,
    Damaged: 0,
    deliveredAndSold: 0,
  };
  for (const batch of product.batches) {
    total.Available += batch.buckets.Available;
    total.Reserved += batch.buckets.Reserved;
    total['On the Van'] += batch.buckets['On the Van'];
    total['Pending Return'] += batch.buckets['Pending Return'];
    total.Damaged += batch.buckets.Damaged;
    total.deliveredAndSold += batch.deliveredAndSoldCartons;
  }
  return total;
}

export function getWarehouseTotals(products: Product[]) {
  const buckets: StockBuckets = {
    Available: 0,
    Reserved: 0,
    'On the Van': 0,
    'Pending Return': 0,
    Damaged: 0,
  };
  let deliveredAndSold = 0;
  let totalWarehouseValueEtb = 0;
  let deliveredValueEtb = 0;

  for (const p of products) {
    const s = getProductStockSummary(p);
    buckets.Available += s.Available;
    buckets.Reserved += s.Reserved;
    buckets['On the Van'] += s['On the Van'];
    buckets['Pending Return'] += s['Pending Return'];
    buckets.Damaged += s.Damaged;
    deliveredAndSold += s.deliveredAndSold;

    const warehouseCartons =
      s.Available + s.Reserved + s['On the Van'] + s['Pending Return'] + s.Damaged;
    totalWarehouseValueEtb += warehouseCartons * p.pricePerCartonEtb;
    deliveredValueEtb += s.deliveredAndSold * p.pricePerCartonEtb;
  }

  return {
    buckets,
    deliveredAndSold,
    totalWarehouseValueEtb,
    deliveredValueEtb,
  };
}

// SR-03: Sort batches by earliest expiry date first (FEFO)
export function getFefoSortedBatches(product: Product): ProductBatch[] {
  return [...product.batches].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

// SR-02 & SR-03: Allocate cartons from Available across FEFO batches
export function allocateFefoBatches(
  product: Product,
  requestedCartons: number
): {
  canFulfill: boolean;
  totalAvailable: number;
  allocations: {
    batchId: string;
    lotNumber: string;
    binCode: string;
    expiryDate: string;
    cartonsAllocated: number;
  }[];
} {
  const sorted = getFefoSortedBatches(product);
  const totalAvailable = sorted.reduce((acc, b) => acc + b.buckets.Available, 0);

  if (requestedCartons <= 0 || requestedCartons > totalAvailable) {
    return {
      canFulfill: false,
      totalAvailable,
      allocations: [],
    };
  }

  let remaining = requestedCartons;
  const allocations: {
    batchId: string;
    lotNumber: string;
    binCode: string;
    expiryDate: string;
    cartonsAllocated: number;
  }[] = [];

  for (const batch of sorted) {
    if (remaining <= 0) break;
    if (batch.buckets.Available > 0) {
      const take = Math.min(batch.buckets.Available, remaining);
      allocations.push({
        batchId: batch.batchId,
        lotNumber: batch.lotNumber,
        binCode: batch.binCode,
        expiryDate: batch.expiryDate,
        cartonsAllocated: take,
      });
      remaining -= take;
    }
  }

  return {
    canFulfill: remaining === 0,
    totalAvailable,
    allocations,
  };
}

// SR-01 & SR-12: Evaluate Order Commitment Check based on B2B Shop Category
export function evaluateOrderCommitment(
  shop: ShopProfile,
  orderTotalEtb: number,
  managerOverrideCredit: boolean = false
): {
  status: 'Confirmed' | 'Awaiting Deposit Approval';
  requiredDepositPct: number;
  requiredDepositEtb: number;
  reason: string;
} {
  if (shop.shopCategory === 'Regular Trusted Shop') {
    return {
      status: 'Confirmed',
      requiredDepositPct: 0,
      requiredDepositEtb: 0,
      reason: `Regular Trusted Shop (${shop.completedOrdersCount} completed deliveries) — 0% deposit required. Order is Confirmed immediately.`,
    };
  }

  if (shop.shopCategory === 'Credit Shop') {
    const projectedBalance = shop.currentBalanceEtb + orderTotalEtb;
    if (projectedBalance <= shop.creditLimitEtb || managerOverrideCredit) {
      return {
        status: 'Confirmed',
        requiredDepositPct: 0,
        requiredDepositEtb: 0,
        reason: managerOverrideCredit
          ? `Credit Shop — Manager credit override applied. Order Confirmed.`
          : `Credit Shop within limit (ETB ${projectedBalance.toLocaleString()} <= ETB ${shop.creditLimitEtb.toLocaleString()}). Order Confirmed.`,
      };
    } else {
      const pct = Math.max(shop.requiredDepositPct, 15);
      const dep = Math.round((orderTotalEtb * pct) / 100);
      return {
        status: 'Awaiting Deposit Approval',
        requiredDepositPct: pct,
        requiredDepositEtb: dep,
        reason: `Credit Limit Exceeded (ETB ${projectedBalance.toLocaleString()} > ETB ${shop.creditLimitEtb.toLocaleString()}). Requires ${pct}% deposit (ETB ${dep.toLocaleString()}) or Manager override.`,
      };
    }
  }

  if (shop.shopCategory === 'New Shop') {
    const pct = shop.requiredDepositPct > 0 ? shop.requiredDepositPct : 15;
    const dep = Math.round((orderTotalEtb * pct) / 100);
    return {
      status: 'Awaiting Deposit Approval',
      requiredDepositPct: pct,
      requiredDepositEtb: dep,
      reason: `New Shop Policy (SR-01): Requires ${pct}% Telebirr/Bank deposit (ETB ${dep.toLocaleString()}) before warehouse packing.`,
    };
  }

  // Shop with Past Refusal/Cancellation
  const pct = shop.requiredDepositPct > 0 ? shop.requiredDepositPct : 20;
  const dep = Math.round((orderTotalEtb * pct) / 100);
  return {
    status: 'Awaiting Deposit Approval',
    requiredDepositPct: pct,
    requiredDepositEtb: dep,
    reason: `Shop with Past Refusal (${shop.pastRefusalCount} past cancelled/refused): Requires ${pct}% security deposit (ETB ${dep.toLocaleString()}) before packing.`,
  };
}

// Create a new B2B Shop Order (SR-01, SR-02, SR-03)
export function createB2BShopOrder(
  state: HubState,
  params: {
    shopId: string;
    gpsLat: number;
    gpsLng: number;
    lines: { sku: string; cartons: number; loosePieces?: number }[];
    depositReferenceNumber?: string;
    depositPaymentChannel?: PaymentChannel;
    managerOverrideCredit?: boolean;
  }
): { nextState: HubState; createdOrder: ShopOrder; error?: string } {
  const shop = state.shops.find((s) => s.shopId === params.shopId);
  if (!shop) {
    return { nextState: state, createdOrder: null as any, error: 'Shop not found' };
  }

  const nextProducts: Product[] = JSON.parse(JSON.stringify(state.products));
  const orderItems: OrderLineItem[] = [];
  let totalAmountEtb = 0;

  for (const reqLine of params.lines) {
    if (reqLine.cartons <= 0) continue;
    const product = nextProducts.find((p) => p.sku === reqLine.sku);
    if (!product) {
      return { nextState: state, createdOrder: null as any, error: `Product ${reqLine.sku} not found` };
    }
    const alloc = allocateFefoBatches(product, reqLine.cartons);
    if (!alloc.canFulfill) {
      return {
        nextState: state,
        createdOrder: null as any,
        error: `Insufficient Available stock for ${product.nameEn}: requested ${reqLine.cartons} cartons, only ${alloc.totalAvailable} Available.`,
      };
    }
    const lineTotal = reqLine.cartons * product.pricePerCartonEtb;
    totalAmountEtb += lineTotal;
    orderItems.push({
      sku: product.sku,
      productNameEn: product.nameEn,
      productNameAm: product.nameAm,
      cartons: reqLine.cartons,
      loosePieces: reqLine.loosePieces || 0,
      pricePerCartonEtb: product.pricePerCartonEtb,
      lineTotalEtb: lineTotal,
      allocatedBatches: alloc.allocations,
    });
  }

  if (orderItems.length === 0) {
    return { nextState: state, createdOrder: null as any, error: 'Order must contain at least 1 carton.' };
  }

  const commitment = evaluateOrderCommitment(
    shop,
    totalAmountEtb,
    Boolean(params.managerOverrideCredit)
  );

  const orderId = `ORD-2026-${1044 + state.orders.length}`;
  const nowStr = '2026-10-26 10:35';
  const newLogs: BinCardEntry[] = [];

  // Only reserve stock immediately if status is 'Confirmed' (SR-01 Strict Packing Gate)
  if (commitment.status === 'Confirmed') {
    for (const item of orderItems) {
      const prod = nextProducts.find((p) => p.sku === item.sku)!;
      for (const al of item.allocatedBatches) {
        const batch = prod.batches.find((b) => b.batchId === al.batchId)!;
        const before = cloneBuckets(batch.buckets);
        batch.buckets.Available -= al.cartonsAllocated;
        batch.buckets.Reserved += al.cartonsAllocated;
        const after = cloneBuckets(batch.buckets);

        newLogs.push({
          entryId: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowStr,
          actorRole: state.currentRole,
          actorName: state.currentRole,
          voucherType: 'ORDER_RESERVE',
          voucherId: orderId,
          sku: prod.sku,
          productNameEn: prod.nameEn,
          batchId: batch.batchId,
          lotNumber: batch.lotNumber,
          actionSummary: `FEFO Reserved ${al.cartonsAllocated} Cartons for ${shop.nameEn} (${orderId})`,
          beforeBuckets: before,
          afterBuckets: after,
          beforeDeliveredSold: batch.deliveredAndSoldCartons,
          afterDeliveredSold: batch.deliveredAndSoldCartons,
        });
      }
    }
  }

  const nextShops = state.shops.map((s) => {
    if (s.shopId === shop.shopId && commitment.status === 'Confirmed' && s.shopCategory === 'Credit Shop') {
      return { ...s, currentBalanceEtb: s.currentBalanceEtb + totalAmountEtb };
    }
    return s;
  });

  const createdOrder: ShopOrder = {
    orderId,
    createdAt: nowStr,
    shopId: shop.shopId,
    shopNameEn: shop.nameEn,
    shopNameAm: shop.nameAm,
    shopCategory: shop.shopCategory,
    gpsLat: params.gpsLat,
    gpsLng: params.gpsLng,
    items: orderItems,
    totalAmountEtb,
    requiredDepositPct: commitment.requiredDepositPct,
    requiredDepositEtb: commitment.requiredDepositEtb,
    depositReferenceNumber: params.depositReferenceNumber?.trim() || '',
    depositPaymentChannel: params.depositPaymentChannel || 'Telebirr',
    depositVerifiedViaLinksEt: commitment.status === 'Confirmed',
    depositApprovedByAccountant: commitment.status === 'Confirmed',
    status: commitment.status,
    commitmentReason: commitment.reason,
  };

  return {
    nextState: {
      ...state,
      products: nextProducts,
      shops: nextShops,
      orders: [createdOrder, ...state.orders],
      binCardLog: [...newLogs, ...state.binCardLog],
    },
    createdOrder,
  };
}

// SR-01: Verify or Approve Deposit for an order in 'Awaiting Deposit Approval' -> transitions to 'Confirmed' and moves stock Available -> Reserved
export function confirmOrderAndReserveStock(
  state: HubState,
  orderId: string,
  verification: {
    referenceNumber: string;
    paymentChannel: PaymentChannel;
    viaLinksEt: boolean;
    linksEtPayload?: interfaceLinksEtVerificationPayload;
  }
): { nextState: HubState; error?: string } {
  const order = state.orders.find((o) => o.orderId === orderId);
  if (!order) return { nextState: state, error: 'Order not found' };
  if (order.status !== 'Awaiting Deposit Approval') {
    return { nextState: state, error: 'Order is not awaiting deposit approval' };
  }
  if (!verification.referenceNumber.trim()) {
    return { nextState: state, error: 'Deposit transaction reference number is required' };
  }

  const nextProducts: Product[] = JSON.parse(JSON.stringify(state.products));
  const nowStr = '2026-10-26 10:40';
  const newLogs: BinCardEntry[] = [];

  // Re-allocate FEFO batches and move Available -> Reserved
  const updatedItems: OrderLineItem[] = [];
  for (const item of order.items) {
    const prod = nextProducts.find((p) => p.sku === item.sku)!;
    const alloc = allocateFefoBatches(prod, item.cartons);
    if (!alloc.canFulfill) {
      return {
        nextState: state,
        error: `Cannot confirm order: ${prod.nameEn} only has ${alloc.totalAvailable} Available cartons.`,
      };
    }

    for (const al of alloc.allocations) {
      const batch = prod.batches.find((b) => b.batchId === al.batchId)!;
      const before = cloneBuckets(batch.buckets);
      batch.buckets.Available -= al.cartonsAllocated;
      batch.buckets.Reserved += al.cartonsAllocated;
      const after = cloneBuckets(batch.buckets);

      newLogs.push({
        entryId: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowStr,
        actorRole: state.currentRole,
        actorName: verification.viaLinksEt ? 'links.et Payment Gateway' : state.currentRole,
        voucherType: 'ORDER_RESERVE',
        voucherId: order.orderId,
        sku: prod.sku,
        productNameEn: prod.nameEn,
        batchId: batch.batchId,
        lotNumber: batch.lotNumber,
        actionSummary: `Deposit Verified (${verification.referenceNumber}) -> Reserved ${al.cartonsAllocated} Cartons (FEFO) for ${order.shopNameEn}`,
        beforeBuckets: before,
        afterBuckets: after,
        beforeDeliveredSold: batch.deliveredAndSoldCartons,
        afterDeliveredSold: batch.deliveredAndSoldCartons,
      });
    }

    updatedItems.push({
      ...item,
      allocatedBatches: alloc.allocations,
    });
  }

  const nextOrders = state.orders.map((o) => {
    if (o.orderId !== orderId) return o;
    return {
      ...o,
      items: updatedItems,
      depositReferenceNumber: verification.referenceNumber.trim(),
      depositPaymentChannel: verification.paymentChannel,
      depositVerifiedViaLinksEt: verification.viaLinksEt,
      depositApprovedByAccountant: true,
      linksEtResponse: verification.linksEtPayload,
      status: 'Confirmed' as const,
      commitmentReason: `Deposit ETB ${o.requiredDepositEtb.toLocaleString()} verified (${
        verification.viaLinksEt ? 'links.et API' : 'Accountant Manual Approval'
      }, Ref: ${verification.referenceNumber.trim()}). Stock moved from Available to Reserved.`,
    };
  });

  return {
    nextState: {
      ...state,
      products: nextProducts,
      orders: nextOrders,
      binCardLog: [...newLogs, ...state.binCardLog],
    },
  };
}

// SR-04: Process Blind Receiving (GRN)
export function processBlindGrn(
  state: HubState,
  params: {
    poId: string;
    countedGoodCartons: number;
    countedLoosePieces: number;
    countedDamagedCartons: number;
    lotNumber: string;
    expiryDate: string;
    binCode: string;
  }
): {
  nextState: HubState;
  voucher?: PrintableVoucher;
  varianceCartons?: number;
  expectedCartons?: number;
  error?: string;
} {
  const po = state.purchaseOrders.find((p) => p.poId === params.poId);
  if (!po) return { nextState: state, error: 'Purchase Order not found' };
  if (po.status === 'GRN Completed') {
    return { nextState: state, error: 'GRN already completed for this Purchase Order' };
  }
  if (params.countedGoodCartons < 0 || params.countedDamagedCartons < 0) {
    return { nextState: state, error: 'Counts cannot be negative' };
  }
  if (!params.lotNumber.trim() || !params.expiryDate.trim()) {
    return { nextState: state, error: 'Batch Lot Number and Expiry Date are required' };
  }

  const nextProducts: Product[] = JSON.parse(JSON.stringify(state.products));
  const product = nextProducts.find((p) => p.sku === po.sku);
  if (!product) return { nextState: state, error: 'Product not found' };

  const nowStr = '2026-10-26 10:45';
  const grnVoucherId = `GRN-2026-04${12 + state.vouchers.length}`;
  const totalCountedCartons = params.countedGoodCartons + params.countedDamagedCartons;
  const varianceCartons = totalCountedCartons - po.expectedCartons;

  let targetBatch = product.batches.find(
    (b) => b.lotNumber.toUpperCase() === params.lotNumber.trim().toUpperCase()
  );

  const beforeBuckets: StockBuckets = targetBatch
    ? cloneBuckets(targetBatch.buckets)
    : { Available: 0, Reserved: 0, 'On the Van': 0, 'Pending Return': 0, Damaged: 0 };

  if (targetBatch) {
    targetBatch.buckets.Available += params.countedGoodCartons;
    targetBatch.buckets.Damaged += params.countedDamagedCartons;
  } else {
    const expMs = new Date(params.expiryDate).getTime() - new Date('2026-10-26').getTime();
    const daysUntilExpiry = Math.max(1, Math.round(expMs / (1000 * 60 * 60 * 24)));
    targetBatch = {
      batchId: `BATCH-${Date.now()}`,
      lotNumber: params.lotNumber.trim().toUpperCase(),
      sku: product.sku,
      expiryDate: params.expiryDate,
      daysUntilExpiry,
      binCode: params.binCode || product.defaultBinCode,
      buckets: {
        Available: params.countedGoodCartons,
        Reserved: 0,
        'On the Van': 0,
        'Pending Return': 0,
        Damaged: params.countedDamagedCartons,
      },
      deliveredAndSoldCartons: 0,
    };
    product.batches.push(targetBatch);
  }

  const afterBuckets = cloneBuckets(targetBatch.buckets);

  const newLog: BinCardEntry = {
    entryId: `LOG-${Date.now()}-GRN`,
    timestamp: nowStr,
    actorRole: state.currentRole,
    actorName: 'Storekeeper (Kality Warehouse)',
    voucherType: 'GRN',
    voucherId: grnVoucherId,
    sku: product.sku,
    productNameEn: product.nameEn,
    batchId: targetBatch.batchId,
    lotNumber: targetBatch.lotNumber,
    actionSummary: `Blind GRN (${po.poId}): +${params.countedGoodCartons} Cartons to Available, +${params.countedDamagedCartons} Cartons to Damaged (Expected: ${po.expectedCartons}, Variance: ${varianceCartons >= 0 ? '+' : ''}${varianceCartons})`,
    beforeBuckets,
    afterBuckets,
    beforeDeliveredSold: targetBatch.deliveredAndSoldCartons,
    afterDeliveredSold: targetBatch.deliveredAndSoldCartons,
  };

  const voucher: PrintableVoucher = {
    voucherId: grnVoucherId,
    voucherType: 'GRN',
    createdAt: nowStr,
    createdByRole: state.currentRole,
    counterpartyName: `${po.supplierName} (Truck ${po.truckPlate})`,
    referenceDocId: po.poId,
    notes: `Blind Count Verified. PO Expected: ${po.expectedCartons} Ctn | Physical Count: ${params.countedGoodCartons} Good Ctn + ${params.countedDamagedCartons} Damaged Ctn (${params.countedLoosePieces} Loose Pcs). Variance: ${varianceCartons} Ctn.`,
    lines: [
      {
        sku: product.sku,
        productNameEn: product.nameEn,
        productNameAm: product.nameAm,
        lotNumber: targetBatch.lotNumber,
        expiryDate: targetBatch.expiryDate,
        binCode: targetBatch.binCode,
        cartons: params.countedGoodCartons,
        loosePieces: params.countedLoosePieces,
        damagedOrRejectedCartons: params.countedDamagedCartons,
        fromBucket: 'Supplier Truck (Inbound)',
        toBucket:
          params.countedDamagedCartons > 0
            ? `Available (+${params.countedGoodCartons}) & Damaged (+${params.countedDamagedCartons})`
            : `Available (+${params.countedGoodCartons})`,
        unitValueEtb: product.pricePerCartonEtb,
      },
    ],
  };

  const nextPos = state.purchaseOrders.map((item) =>
    item.poId === po.poId
      ? {
          ...item,
          status: 'GRN Completed' as const,
          grnVoucherId,
          recordedGoodCartons: params.countedGoodCartons,
          recordedLoosePieces: params.countedLoosePieces,
          recordedDamagedCartons: params.countedDamagedCartons,
          recordedLotNumber: targetBatch!.lotNumber,
          recordedExpiryDate: targetBatch!.expiryDate,
        }
      : item
  );

  return {
    nextState: {
      ...state,
      products: nextProducts,
      purchaseOrders: nextPos,
      binCardLog: [newLog, ...state.binCardLog],
      vouchers: [voucher, ...state.vouchers],
    },
    voucher,
    varianceCartons,
    expectedCartons: po.expectedCartons,
  };
}

// SR-03 & SR-05: Pack Confirmed Order & Issue SIV to Van (Reserved -> On the Van)
export function packAndIssueSiv(
  state: HubState,
  params: {
    orderId: string;
    driverName: string;
    driverPhone: string;
    vanPlate: string;
  }
): { nextState: HubState; voucher?: PrintableVoucher; trip?: DeliveryTrip; error?: string } {
  const order = state.orders.find((o) => o.orderId === params.orderId);
  if (!order) return { nextState: state, error: 'Order not found' };
  if (order.status !== 'Confirmed') {
    return {
      nextState: state,
      error: `Strict Packing Gate (SR-01): Order ${order.orderId} is "${order.status}" and cannot be packed until Confirmed.`,
    };
  }

  const shop = state.shops.find((s) => s.shopId === order.shopId)!;
  const nextProducts: Product[] = JSON.parse(JSON.stringify(state.products));
  const nowStr = '2026-10-26 11:00';
  const sivVoucherId = `SIV-2026-08${20 + state.vouchers.length}`;
  const tripId = `TRIP-2026-09${1 + state.trips.length}`;

  const newLogs: BinCardEntry[] = [];
  const voucherLines: PrintableVoucher['lines'] = [];
  const stopItems: DeliveryTrip['items'] = [];

  for (const item of order.items) {
    const prod = nextProducts.find((p) => p.sku === item.sku)!;
    for (const al of item.allocatedBatches) {
      const batch = prod.batches.find((b) => b.batchId === al.batchId)!;
      const before = cloneBuckets(batch.buckets);
      batch.buckets.Reserved -= al.cartonsAllocated;
      batch.buckets['On the Van'] += al.cartonsAllocated;
      const after = cloneBuckets(batch.buckets);

      newLogs.push({
        entryId: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowStr,
        actorRole: state.currentRole,
        actorName: 'Storekeeper (Kality Warehouse)',
        voucherType: 'SIV',
        voucherId: sivVoucherId,
        sku: prod.sku,
        productNameEn: prod.nameEn,
        batchId: batch.batchId,
        lotNumber: batch.lotNumber,
        actionSummary: `Issued SIV (${sivVoucherId}): Moved ${al.cartonsAllocated} Cartons from Reserved to On the Van (${params.vanPlate})`,
        beforeBuckets: before,
        afterBuckets: after,
        beforeDeliveredSold: batch.deliveredAndSoldCartons,
        afterDeliveredSold: batch.deliveredAndSoldCartons,
      });

      voucherLines.push({
        sku: prod.sku,
        productNameEn: prod.nameEn,
        productNameAm: prod.nameAm,
        lotNumber: batch.lotNumber,
        expiryDate: batch.expiryDate,
        binCode: batch.binCode,
        cartons: al.cartonsAllocated,
        fromBucket: 'Reserved',
        toBucket: 'On the Van',
        unitValueEtb: prod.pricePerCartonEtb,
      });

      stopItems.push({
        sku: prod.sku,
        productNameEn: prod.nameEn,
        productNameAm: prod.nameAm,
        lotNumber: batch.lotNumber,
        batchId: batch.batchId,
        loadedCartons: al.cartonsAllocated,
        acceptedCartons: al.cartonsAllocated,
        rejectedCartons: 0,
        pricePerCartonEtb: prod.pricePerCartonEtb,
      });
    }
  }

  const voucher: PrintableVoucher = {
    voucherId: sivVoucherId,
    voucherType: 'SIV',
    createdAt: nowStr,
    createdByRole: state.currentRole,
    counterpartyName: `${params.driverName} — Van ${params.vanPlate} (To: ${order.shopNameEn})`,
    referenceDocId: order.orderId,
    notes: `FEFO Verified Pick List. Dispatched to ${order.shopNameEn} (${shop.landmarkNote}).`,
    lines: voucherLines,
  };

  const trip: DeliveryTrip = {
    tripId,
    sivVoucherId,
    orderId: order.orderId,
    driverName: params.driverName,
    driverPhone: params.driverPhone,
    vanPlate: params.vanPlate,
    dispatchedAt: nowStr,
    shopId: shop.shopId,
    shopNameEn: shop.nameEn,
    shopNameAm: shop.nameAm,
    shopPhoneMasked: shop.phoneMasked,
    shopPhoneFull: shop.phoneFull,
    gpsLat: order.gpsLat,
    gpsLng: order.gpsLng,
    landmarkNote: shop.landmarkNote,
    items: stopItems,
    totalLoadedValueEtb: order.totalAmountEtb,
    acceptedValueEtb: 0,
    depositAlreadyPaidEtb: order.requiredDepositEtb,
    balanceCollectedEtb: 0,
    paymentMethod: order.depositPaymentChannel || 'Telebirr',
    paymentReferenceNumber: '',
    paymentVerifiedViaLinksEt: false,
    customerSignatureName: '',
    stopStatus: 'Out for Delivery',
    tripClosed: false,
    settledByAccountant: false,
  };

  const nextOrders = state.orders.map((o) =>
    o.orderId === order.orderId
      ? {
          ...o,
          status: 'On the Van (SIV Issued)' as const,
          sivVoucherId,
          assignedTripId: tripId,
        }
      : o
  );

  return {
    nextState: {
      ...state,
      products: nextProducts,
      orders: nextOrders,
      trips: [trip, ...state.trips],
      binCardLog: [...newLogs, ...state.binCardLog],
      vouchers: [voucher, ...state.vouchers],
    },
    voucher,
    trip,
  };
}

// SR-06, SR-07, SR-08, NFR-01: Driver Doorstep Delivery (Full or Partial, Online or Offline Queue)
export function recordDriverDelivery(
  state: HubState,
  params: {
    tripId: string;
    itemOutcomes: {
      sku: string;
      batchId: string;
      acceptedCartons: number;
      rejectedCartons: number;
    }[];
    rejectionReason?: string;
    paymentMethod: PaymentChannel;
    paymentReferenceNumber: string;
    paymentVerifiedViaLinksEt: boolean;
    customerSignatureName: string;
    forceImmediateApply?: boolean;
  }
): { nextState: HubState; queuedOffline: boolean; error?: string } {
  const trip = state.trips.find((t) => t.tripId === params.tripId);
  if (!trip) return { nextState: state, queuedOffline: false, error: 'Trip not found' };
  if (trip.stopStatus !== 'Out for Delivery') {
    return { nextState: state, queuedOffline: false, error: 'Delivery stop already processed' };
  }
  if (!params.paymentReferenceNumber.trim() && params.paymentMethod !== 'Cash on Delivery') {
    return {
      nextState: state,
      queuedOffline: false,
      error: 'Payment Reference Number is required for digital transfers',
    };
  }
  if (!params.customerSignatureName.trim()) {
    return {
      nextState: state,
      queuedOffline: false,
      error: 'Shop receiver signature name is required',
    };
  }

  let totalAccepted = 0;
  let totalRejected = 0;
  let acceptedValueEtb = 0;

  for (const outcome of params.itemOutcomes) {
    const stopItem = trip.items.find(
      (i) => i.sku === outcome.sku && i.batchId === outcome.batchId
    );
    if (!stopItem) continue;
    if (outcome.acceptedCartons + outcome.rejectedCartons !== stopItem.loadedCartons) {
      return {
        nextState: state,
        queuedOffline: false,
        error: `Accepted (${outcome.acceptedCartons}) + Rejected (${outcome.rejectedCartons}) must equal Loaded Cartons (${stopItem.loadedCartons}) for ${stopItem.productNameEn}.`,
      };
    }
    totalAccepted += outcome.acceptedCartons;
    totalRejected += outcome.rejectedCartons;
    acceptedValueEtb += outcome.acceptedCartons * stopItem.pricePerCartonEtb;
  }

  const balanceCollectedEtb = Math.max(0, acceptedValueEtb - trip.depositAlreadyPaidEtb);

  // If driver is offline and not forcing sync, store in offlineQueue (NFR-01, SR-07)
  if (!state.driverOnline && !params.forceImmediateApply) {
    const queueItem = {
      queueId: `OFFLINE-${Date.now()}`,
      createdAt: '2026-10-26 11:30',
      tripId: trip.tripId,
      shopNameEn: trip.shopNameEn,
      actionType:
        totalRejected > 0 ? ('PARTIAL_DELIVERY' as const) : ('FULL_DELIVERY' as const),
      acceptedCartonsTotal: totalAccepted,
      rejectedCartonsTotal: totalRejected,
      rejectionReason: params.rejectionReason,
      paymentChannel: params.paymentMethod,
      paymentReferenceNumber:
        params.paymentReferenceNumber.trim() || `CASH-${trip.tripId}`,
      amountCollectedEtb: balanceCollectedEtb,
      signatureName: params.customerSignatureName.trim(),
      itemBreakdowns: params.itemOutcomes,
      synced: false,
    };

    return {
      nextState: {
        ...state,
        offlineQueue: [queueItem, ...state.offlineQueue],
      },
      queuedOffline: true,
    };
  }

  // Online or syncing offline queue: update stock buckets immediately
  const nextProducts: Product[] = JSON.parse(JSON.stringify(state.products));
  const nowStr = '2026-10-26 11:35';
  const newLogs: BinCardEntry[] = [];

  for (const outcome of params.itemOutcomes) {
    const prod = nextProducts.find((p) => p.sku === outcome.sku)!;
    const batch = prod.batches.find((b) => b.batchId === outcome.batchId)!;
    const before = cloneBuckets(batch.buckets);
    const beforeSold = batch.deliveredAndSoldCartons;

    // Remove loaded cartons from 'On the Van'
    batch.buckets['On the Van'] -= outcome.acceptedCartons + outcome.rejectedCartons;
    // Accepted boxes leave warehouse stock and increment Delivered & Sold
    batch.deliveredAndSoldCartons += outcome.acceptedCartons;
    // Rejected boxes move into 'Pending Return'
    batch.buckets['Pending Return'] += outcome.rejectedCartons;

    const after = cloneBuckets(batch.buckets);
    const afterSold = batch.deliveredAndSoldCartons;

    newLogs.push({
      entryId: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowStr,
      actorRole: 'Delivery Driver (Mobile Phone View)',
      actorName: `Driver ${trip.driverName}`,
      voucherType: 'DELIVERY_POD',
      voucherId: `POD-${trip.tripId}`,
      sku: prod.sku,
      productNameEn: prod.nameEn,
      batchId: batch.batchId,
      lotNumber: batch.lotNumber,
      actionSummary:
        outcome.rejectedCartons > 0
          ? `Partial Delivery at ${trip.shopNameEn}: ${outcome.acceptedCartons} Ctn Delivered & Sold, ${outcome.rejectedCartons} Ctn Rejected -> Pending Return (Trip Locked)`
          : `Full Delivery at ${trip.shopNameEn}: ${outcome.acceptedCartons} Ctn Delivered & Sold`,
      beforeBuckets: before,
      afterBuckets: after,
      beforeDeliveredSold: beforeSold,
      afterDeliveredSold: afterSold,
    });
  }

  const hasRejected = totalRejected > 0;
  const nextTrips = state.trips.map((t) => {
    if (t.tripId !== trip.tripId) return t;
    return {
      ...t,
      items: t.items.map((it) => {
        const out = params.itemOutcomes.find(
          (o) => o.sku === it.sku && o.batchId === it.batchId
        );
        return out
          ? {
              ...it,
              acceptedCartons: out.acceptedCartons,
              rejectedCartons: out.rejectedCartons,
              rejectionReason: params.rejectionReason,
            }
          : it;
      }),
      acceptedValueEtb,
      balanceCollectedEtb,
      paymentMethod: params.paymentMethod,
      paymentReferenceNumber:
        params.paymentReferenceNumber.trim() || `CASH-${trip.tripId}`,
      paymentVerifiedViaLinksEt: params.paymentVerifiedViaLinksEt,
      customerSignatureName: params.customerSignatureName.trim(),
      stopStatus: hasRejected
        ? ('Partial Delivery — Pending Return Gate Lock' as const)
        : ('Delivered (Full)' as const),
      tripClosed: !hasRejected,
      tripLockedReason: hasRejected
        ? `${totalRejected} Rejected Cartons in Pending Return bucket (${
            params.rejectionReason || 'Shop Refusal'
          }). Storekeeper must issue SRN at Kality Gate to unlock trip.`
        : undefined,
    };
  });

  const nextOrders = state.orders.map((o) => {
    if (o.orderId !== trip.orderId) return o;
    return {
      ...o,
      status: hasRejected
        ? ('Partially Delivered (Pending Return)' as const)
        : ('Delivered & Settled' as const),
    };
  });

  return {
    nextState: {
      ...state,
      products: nextProducts,
      trips: nextTrips,
      orders: nextOrders,
      binCardLog: [...newLogs, ...state.binCardLog],
    },
    queuedOffline: false,
  };
}

// Sync all items in Driver Offline Sync Queue when back online (NFR-01)
export function syncDriverOfflineQueue(state: HubState): {
  nextState: HubState;
  syncedCount: number;
} {
  let workingState: HubState = { ...state, driverOnline: true };
  let syncedCount = 0;

  for (const item of state.offlineQueue) {
    if (item.synced) continue;
    const res = recordDriverDelivery(workingState, {
      tripId: item.tripId,
      itemOutcomes: item.itemBreakdowns,
      rejectionReason: item.rejectionReason,
      paymentMethod: item.paymentChannel,
      paymentReferenceNumber: item.paymentReferenceNumber,
      paymentVerifiedViaLinksEt: false,
      customerSignatureName: item.signatureName,
      forceImmediateApply: true,
    });
    if (!res.error) {
      workingState = res.nextState;
      syncedCount++;
    }
  }

  workingState = {
    ...workingState,
    offlineQueue: workingState.offlineQueue.map((q) => ({ ...q, synced: true })),
  };

  return { nextState: workingState, syncedCount };
}

// SR-08: Storekeeper Gate-In Return Check (SRN) — Splits Pending Return into Available and Damaged, unlocks Driver Trip
export function processGateInSrn(
  state: HubState,
  params: {
    tripId: string;
    inspections: {
      sku: string;
      batchId: string;
      checkedOkToAvailable: number;
      checkedBrokenToDamaged: number;
    }[];
    notes?: string;
  }
): { nextState: HubState; voucher?: PrintableVoucher; error?: string } {
  const trip = state.trips.find((t) => t.tripId === params.tripId);
  if (!trip) return { nextState: state, error: 'Trip not found' };
  if (trip.stopStatus !== 'Partial Delivery — Pending Return Gate Lock') {
    return { nextState: state, error: 'Trip does not have Pending Return items waiting for Gate-In' };
  }

  const nextProducts: Product[] = JSON.parse(JSON.stringify(state.products));
  const nowStr = '2026-10-26 16:45';
  const srnVoucherId = `SRN-2026-01${10 + state.vouchers.length}`;
  const newLogs: BinCardEntry[] = [];
  const voucherLines: PrintableVoucher['lines'] = [];

  for (const insp of params.inspections) {
    const stopItem = trip.items.find(
      (i) => i.sku === insp.sku && i.batchId === insp.batchId
    );
    if (!stopItem || stopItem.rejectedCartons === 0) continue;

    if (
      insp.checkedOkToAvailable + insp.checkedBrokenToDamaged !==
      stopItem.rejectedCartons
    ) {
      return {
        nextState: state,
        error: `Checked OK (${insp.checkedOkToAvailable}) + Checked Broken (${insp.checkedBrokenToDamaged}) must equal Pending Return Cartons (${stopItem.rejectedCartons}) for ${stopItem.productNameEn}.`,
      };
    }

    const prod = nextProducts.find((p) => p.sku === insp.sku)!;
    const batch = prod.batches.find((b) => b.batchId === insp.batchId)!;
    const before = cloneBuckets(batch.buckets);

    batch.buckets['Pending Return'] -= stopItem.rejectedCartons;
    batch.buckets.Available += insp.checkedOkToAvailable;
    batch.buckets.Damaged += insp.checkedBrokenToDamaged;

    const after = cloneBuckets(batch.buckets);

    newLogs.push({
      entryId: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowStr,
      actorRole: state.currentRole,
      actorName: 'Storekeeper (Kality Warehouse)',
      voucherType: 'SRN',
      voucherId: srnVoucherId,
      sku: prod.sku,
      productNameEn: prod.nameEn,
      batchId: batch.batchId,
      lotNumber: batch.lotNumber,
      actionSummary: `Gate-In SRN (${srnVoucherId}) from ${trip.vanPlate}: ${insp.checkedOkToAvailable} Ctn -> Available, ${insp.checkedBrokenToDamaged} Ctn -> Damaged`,
      beforeBuckets: before,
      afterBuckets: after,
      beforeDeliveredSold: batch.deliveredAndSoldCartons,
      afterDeliveredSold: batch.deliveredAndSoldCartons,
    });

    voucherLines.push({
      sku: prod.sku,
      productNameEn: prod.nameEn,
      productNameAm: prod.nameAm,
      lotNumber: batch.lotNumber,
      expiryDate: batch.expiryDate,
      binCode: batch.binCode,
      cartons: stopItem.rejectedCartons,
      damagedOrRejectedCartons: insp.checkedBrokenToDamaged,
      fromBucket: 'Pending Return',
      toBucket: `Available (+${insp.checkedOkToAvailable}) / Damaged (+${insp.checkedBrokenToDamaged})`,
      unitValueEtb: prod.pricePerCartonEtb,
    });
  }

  const voucher: PrintableVoucher = {
    voucherId: srnVoucherId,
    voucherType: 'SRN',
    createdAt: nowStr,
    createdByRole: state.currentRole,
    counterpartyName: `Driver ${trip.driverName} — Van ${trip.vanPlate} (Return from ${trip.shopNameEn})`,
    referenceDocId: trip.tripId,
    notes:
      params.notes ||
      `Gate-In physical inspection completed. Driver trip ${trip.tripId} unlocked for 5:00 PM settlement.`,
    lines: voucherLines,
  };

  const nextTrips = state.trips.map((t) =>
    t.tripId === trip.tripId
      ? {
          ...t,
          stopStatus: 'Gate-In SRN Completed & Unlocked' as const,
          tripClosed: true,
          tripLockedReason: undefined,
          srnVoucherId,
        }
      : t
  );

  return {
    nextState: {
      ...state,
      products: nextProducts,
      trips: nextTrips,
      binCardLog: [...newLogs, ...state.binCardLog],
      vouchers: [voucher, ...state.vouchers],
    },
    voucher,
  };
}

// SR-10 & NFR-03: Manager Write-Off Approval (ADJ) for Damaged Stock
export function approveDamagedWriteOff(
  state: HubState,
  params: {
    sku: string;
    batchId: string;
    cartonsToWriteOff: number;
    reason: string;
  }
): { nextState: HubState; voucher?: PrintableVoucher; error?: string } {
  if (state.currentRole !== 'Owner / Manager') {
    return {
      nextState: state,
      error:
        'Role Security Restriction (NFR-03): Only the Owner / Manager role can approve Damaged Stock Write-Offs (ADJ).',
    };
  }

  const nextProducts: Product[] = JSON.parse(JSON.stringify(state.products));
  const prod = nextProducts.find((p) => p.sku === params.sku);
  if (!prod) return { nextState: state, error: 'Product not found' };
  const batch = prod.batches.find((b) => b.batchId === params.batchId);
  if (!batch) return { nextState: state, error: 'Batch not found' };

  if (
    params.cartonsToWriteOff <= 0 ||
    params.cartonsToWriteOff > batch.buckets.Damaged
  ) {
    return {
      nextState: state,
      error: `Invalid write-off quantity: batch has ${batch.buckets.Damaged} Damaged cartons.`,
    };
  }

  const nowStr = '2026-10-26 17:10';
  const adjVoucherId = `ADJ-2026-00${5 + state.vouchers.length}`;
  const before = cloneBuckets(batch.buckets);
  batch.buckets.Damaged -= params.cartonsToWriteOff;
  const after = cloneBuckets(batch.buckets);

  const newLog: BinCardEntry = {
    entryId: `LOG-${Date.now()}-ADJ`,
    timestamp: nowStr,
    actorRole: 'Owner / Manager',
    actorName: 'General Manager Dawit',
    voucherType: 'ADJ',
    voucherId: adjVoucherId,
    sku: prod.sku,
    productNameEn: prod.nameEn,
    batchId: batch.batchId,
    lotNumber: batch.lotNumber,
    actionSummary: `Manager Approved Write-Off (${adjVoucherId}): Removed ${params.cartonsToWriteOff} Cartons from Damaged (${params.reason})`,
    beforeBuckets: before,
    afterBuckets: after,
    beforeDeliveredSold: batch.deliveredAndSoldCartons,
    afterDeliveredSold: batch.deliveredAndSoldCartons,
  };

  const voucher: PrintableVoucher = {
    voucherId: adjVoucherId,
    voucherType: 'ADJ',
    createdAt: nowStr,
    createdByRole: 'Owner / Manager',
    counterpartyName: 'Kality Warehouse Damaged Corner Write-Off',
    referenceDocId: batch.lotNumber,
    notes: `Manager Write-Off Reason: ${params.reason}`,
    lines: [
      {
        sku: prod.sku,
        productNameEn: prod.nameEn,
        productNameAm: prod.nameAm,
        lotNumber: batch.lotNumber,
        expiryDate: batch.expiryDate,
        binCode: batch.binCode,
        cartons: params.cartonsToWriteOff,
        fromBucket: 'Damaged',
        toBucket: 'Written Off (Removed from Inventory)',
        unitValueEtb: prod.pricePerCartonEtb,
      },
    ],
  };

  return {
    nextState: {
      ...state,
      products: nextProducts,
      binCardLog: [newLog, ...state.binCardLog],
      vouchers: [voucher, ...state.vouchers],
    },
    voucher,
  };
}

// SR-04 & SR-10: Blind Shelf Cycle Count
export function performBlindCycleCount(
  state: HubState,
  params: {
    sku: string;
    batchId: string;
    countedCartons: number;
    countedLoosePieces: number;
  }
): { nextState: HubState; record?: BlindCycleCountRecord; error?: string } {
  const prod = state.products.find((p) => p.sku === params.sku);
  if (!prod) return { nextState: state, error: 'Product not found' };
  const batch = prod.batches.find((b) => b.batchId === params.batchId);
  if (!batch) return { nextState: state, error: 'Batch not found' };

  const expected = batch.buckets.Available;
  const variance = params.countedCartons - expected;

  const record: BlindCycleCountRecord = {
    countId: `CC-2026-${101 + state.cycleCounts.length}`,
    timestamp: '2026-10-26 17:00',
    sku: prod.sku,
    batchId: batch.batchId,
    lotNumber: batch.lotNumber,
    binCode: batch.binCode,
    countedCartons: params.countedCartons,
    countedLoosePieces: params.countedLoosePieces,
    expectedAvailableCartons: expected,
    varianceCartons: variance,
    countedBy: state.currentRole,
    status: variance === 0 ? 'Matched' : 'Variance Flagged for Manager',
  };

  return {
    nextState: {
      ...state,
      cycleCounts: [record, ...state.cycleCounts],
    },
    record,
  };
}
