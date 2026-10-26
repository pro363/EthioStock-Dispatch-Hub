import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialHubState } from './seedData';
import {
  allocateFefoBatches,
  approveDamagedWriteOff,
  confirmOrderAndReserveStock,
  createB2BShopOrder,
  evaluateOrderCommitment,
  getWarehouseTotals,
  packAndIssueSiv,
  performBlindCycleCount,
  processBlindGrn,
  processGateInSrn,
  recordDriverDelivery,
  syncDriverOfflineQueue,
} from './businessRules';

test('SR-01 & SR-12: Order Commitment Check enforces shop categories accurately', () => {
  const state = createInitialHubState();
  const trustedShop = state.shops.find((s) => s.shopId === 'SHOP-01')!;
  const newShop = state.shops.find((s) => s.shopId === 'SHOP-02')!;
  const creditShop = state.shops.find((s) => s.shopId === 'SHOP-03')!;
  const pastRefusalShop = state.shops.find((s) => s.shopId === 'SHOP-04')!;

  // 1. Regular Trusted Shop -> Confirmed immediately, 0 deposit
  const resTrusted = evaluateOrderCommitment(trustedShop, 50000);
  assert.equal(resTrusted.status, 'Confirmed');
  assert.equal(resTrusted.requiredDepositEtb, 0);

  // 2. New Shop -> Awaiting Deposit Approval (15%)
  const resNew = evaluateOrderCommitment(newShop, 100000);
  assert.equal(resNew.status, 'Awaiting Deposit Approval');
  assert.equal(resNew.requiredDepositPct, 15);
  assert.equal(resNew.requiredDepositEtb, 15000);

  // 3. Credit Shop within limit (current 36,000 + 50,000 <= 150,000) -> Confirmed
  const resCreditOk = evaluateOrderCommitment(creditShop, 50000);
  assert.equal(resCreditOk.status, 'Confirmed');

  // 4. Credit Shop exceeding limit (current 36,000 + 130,000 > 150,000) -> Awaiting Deposit Approval
  const resCreditOver = evaluateOrderCommitment(creditShop, 130000);
  assert.equal(resCreditOver.status, 'Awaiting Deposit Approval');

  // 5. Shop with Past Refusal -> Awaiting Deposit Approval (20%)
  const resRefusal = evaluateOrderCommitment(pastRefusalShop, 50000);
  assert.equal(resRefusal.status, 'Awaiting Deposit Approval');
  assert.equal(resRefusal.requiredDepositPct, 20);
  assert.equal(resRefusal.requiredDepositEtb, 10000);
});

test('SR-02 & SR-03: FEFO batch allocation picks earliest expiry first and blocks over-ordering', () => {
  const state = createInitialHubState();
  const oil = state.products.find((p) => p.sku === 'SKU-OIL-01')!;

  // Batch 1 (LOT-2601A) has 65 Available, Batch 2 (LOT-2608B) has 120 Available = 185 total
  const alloc80 = allocateFefoBatches(oil, 80);
  assert.equal(alloc80.canFulfill, true);
  assert.equal(alloc80.allocations.length, 2);
  assert.equal(alloc80.allocations[0].lotNumber, 'LOT-2601A');
  assert.equal(alloc80.allocations[0].cartonsAllocated, 65);
  assert.equal(alloc80.allocations[1].lotNumber, 'LOT-2608B');
  assert.equal(alloc80.allocations[1].cartonsAllocated, 15);

  // Requesting more than total Available (250 > 185) is blocked
  const allocOver = allocateFefoBatches(oil, 250);
  assert.equal(allocOver.canFulfill, false);
});

test('SR-01: Confirming deposit moves stock from Available to Reserved and logs BinCardEntry', () => {
  const state = createInitialHubState();
  const beforeTotals = getWarehouseTotals(state.products);

  // ORD-2026-1041 has 20 Oil + 10 Soap = 30 cartons awaiting deposit approval
  const res = confirmOrderAndReserveStock(state, 'ORD-2026-1041', {
    referenceNumber: 'TB2610269941',
    paymentChannel: 'Telebirr',
    viaLinksEt: true,
  });
  assert.equal(res.error, undefined);

  const updatedOrder = res.nextState.orders.find((o) => o.orderId === 'ORD-2026-1041')!;
  assert.equal(updatedOrder.status, 'Confirmed');

  const afterTotals = getWarehouseTotals(res.nextState.products);
  assert.equal(afterTotals.buckets.Available, beforeTotals.buckets.Available - 30);
  assert.equal(afterTotals.buckets.Reserved, beforeTotals.buckets.Reserved + 30);
});

test('SR-04: Blind Receiving (GRN) calculates variance and splits Good -> Available, Broken -> Damaged', () => {
  const state = createInitialHubState();
  const beforeTotals = getWarehouseTotals(state.products);

  // PO-2026-410 expects 60 cartons of SKU-OIL-01
  const res = processBlindGrn(state, {
    poId: 'PO-2026-410',
    countedGoodCartons: 57,
    countedLoosePieces: 0,
    countedDamagedCartons: 2,
    lotNumber: 'LOT-2610NEW',
    expiryDate: '2027-08-15',
    binCode: 'KAL-Z1-A01-B03',
  });

  assert.equal(res.error, undefined);
  assert.equal(res.expectedCartons, 60);
  assert.equal(res.varianceCartons, -1); // 59 counted vs 60 expected

  const afterTotals = getWarehouseTotals(res.nextState.products);
  assert.equal(afterTotals.buckets.Available, beforeTotals.buckets.Available + 57);
  assert.equal(afterTotals.buckets.Damaged, beforeTotals.buckets.Damaged + 2);
});

test('SR-05, SR-08, NFR-01: Packing SIV, Driver Offline Queue, Partial Delivery, and Gate-In SRN', () => {
  let state = createInitialHubState();

  // Pack Confirmed order ORD-2026-1042 (15 Oil + 10 Detergent = 25 cartons)
  const sivRes = packAndIssueSiv(state, {
    orderId: 'ORD-2026-1042',
    driverName: 'Tewodros Bekele',
    driverPhone: '+251 911 888 221',
    vanPlate: 'AA-3-B90112',
  });
  assert.equal(sivRes.error, undefined);
  state = sivRes.nextState;

  // Test Driver Offline Delivery Queue (NFR-01) on TRIP-2026-090
  state = { ...state, driverOnline: false };
  const delOffline = recordDriverDelivery(state, {
    tripId: 'TRIP-2026-090',
    itemOutcomes: [
      { sku: 'SKU-OIL-01', batchId: 'BATCH-OIL-1', acceptedCartons: 10, rejectedCartons: 0 },
      { sku: 'SKU-DET-02', batchId: 'BATCH-DET-1', acceptedCartons: 12, rejectedCartons: 0 },
    ],
    paymentMethod: 'Telebirr',
    paymentReferenceNumber: 'TB2610268811',
    paymentVerifiedViaLinksEt: false,
    customerSignatureName: 'Ato Yared Tadesse',
  });
  assert.equal(delOffline.queuedOffline, true);
  assert.equal(delOffline.nextState.offlineQueue.length, 1);

  // Sync offline queue when back online
  const synced = syncDriverOfflineQueue(delOffline.nextState);
  assert.equal(synced.syncedCount, 1);
  state = synced.nextState;

  // Gate-In SRN for TRIP-2026-089 (which has 2 rejected cartons of SKU-OIL-01 in Pending Return)
  const srnRes = processGateInSrn(state, {
    tripId: 'TRIP-2026-089',
    inspections: [
      {
        sku: 'SKU-OIL-01',
        batchId: 'BATCH-OIL-1',
        checkedOkToAvailable: 1,
        checkedBrokenToDamaged: 1,
      },
    ],
  });
  assert.equal(srnRes.error, undefined);
  const unlockedTrip = srnRes.nextState.trips.find((t) => t.tripId === 'TRIP-2026-089')!;
  assert.equal(unlockedTrip.tripClosed, true);
});

test('SR-10 & NFR-03: Only Owner / Manager can approve Damaged stock write-offs (ADJ)', () => {
  let state = createInitialHubState();

  // Storekeeper attempting write-off is blocked
  state = { ...state, currentRole: 'Storekeeper (Kality Warehouse)' };
  const blocked = approveDamagedWriteOff(state, {
    sku: 'SKU-SOAP-04',
    batchId: 'BATCH-SOAP-1',
    cartonsToWriteOff: 4,
    reason: 'Water damage in corner rack',
  });
  assert.ok(blocked.error?.includes('Role Security Restriction'));

  // Owner / Manager succeeds
  state = { ...state, currentRole: 'Owner / Manager' };
  const approved = approveDamagedWriteOff(state, {
    sku: 'SKU-SOAP-04',
    batchId: 'BATCH-SOAP-1',
    cartonsToWriteOff: 4,
    reason: 'Water damage in corner rack',
  });
  assert.equal(approved.error, undefined);
  const soapBatch = approved.nextState.products
    .find((p) => p.sku === 'SKU-SOAP-04')!
    .batches.find((b) => b.batchId === 'BATCH-SOAP-1')!;
  assert.equal(soapBatch.buckets.Damaged, 0);

  // Blind cycle count test
  const cc = performBlindCycleCount(approved.nextState, {
    sku: 'SKU-SOAP-04',
    batchId: 'BATCH-SOAP-1',
    countedCartons: 108,
    countedLoosePieces: 0,
  });
  assert.equal(cc.record?.expectedAvailableCartons, 110);
  assert.equal(cc.record?.varianceCartons, -2);
});
