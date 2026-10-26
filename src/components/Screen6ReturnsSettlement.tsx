import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  EyeOff,
  FileText,
  Lock,
  RotateCcw,
  ShieldAlert,
  Unlock,
  UserCheck,
  Zap,
} from 'lucide-react';
import {
  BlindCycleCountRecord,
  HubState,
  PrintableVoucher,
  UserRole,
} from '../types/domain';
import { LinksEtVerifierModal } from './LinksEtVerifierModal';

interface Screen6ReturnsSettlementProps {
  state: HubState;
  onProcessGateInSrn: (params: {
    tripId: string;
    inspections: {
      sku: string;
      batchId: string;
      checkedOkToAvailable: number;
      checkedBrokenToDamaged: number;
    }[];
    notes?: string;
  }) => { voucher?: PrintableVoucher; error?: string };
  onSettleTripByAccountant: (tripId: string) => void;
  onApproveDamagedWriteOff: (params: {
    sku: string;
    batchId: string;
    cartonsToWriteOff: number;
    reason: string;
  }) => { voucher?: PrintableVoucher; error?: string };
  onPerformBlindCycleCount: (params: {
    sku: string;
    batchId: string;
    countedCartons: number;
    countedLoosePieces: number;
  }) => { record?: BlindCycleCountRecord; error?: string };
  onOpenVoucher: (voucher: PrintableVoucher) => void;
  onSwitchRole: (role: UserRole) => void;
}

export const Screen6ReturnsSettlement: React.FC<Screen6ReturnsSettlementProps> = ({
  state,
  onProcessGateInSrn,
  onSettleTripByAccountant,
  onApproveDamagedWriteOff,
  onPerformBlindCycleCount,
  onOpenVoucher,
  onSwitchRole,
}) => {
  // Part A: Gate-In SRN State
  const [okSplitByItem, setOkSplitByItem] = useState<Record<string, number>>({});
  const [srnBanner, setSrnBanner] = useState<PrintableVoucher | null>(null);
  const [srnError, setSrnError] = useState<string | null>(null);

  // Part B: 5:00 PM Settlement links.et modal state
  const [verifyingTripId, setVerifyingTripId] = useState<string | null>(null);

  // Part C: Blind Cycle Count & Manager Write-Off State
  const [cycleSku, setCycleSku] = useState<string>('SKU-OIL-01');
  const [cycleCountedCartons, setCycleCountedCartons] = useState<string>('65');
  const [cycleCountedLoose, setCycleCountedLoose] = useState<string>('0');
  const [latestCycleRecord, setLatestCycleRecord] =
    useState<BlindCycleCountRecord | null>(null);

  const [writeOffReason, setWriteOffReason] = useState<string>(
    'Crushed & water-damaged outer packaging verified in Kality Damaged Corner'
  );
  const [adjError, setAdjError] = useState<string | null>(null);
  const [adjBanner, setAdjBanner] = useState<PrintableVoucher | null>(null);

  const pendingReturnTrips = state.trips.filter(
    (t) => t.stopStatus === 'Partial Delivery — Pending Return Gate Lock'
  );

  const damagedBatches = state.products.flatMap((p) =>
    p.batches
      .filter((b) => b.buckets.Damaged > 0)
      .map((b) => ({ product: p, batch: b }))
  );

  const handleIssueSrn = (tripId: string) => {
    setSrnError(null);
    const trip = state.trips.find((t) => t.tripId === tripId);
    if (!trip) return;

    const inspections = trip.items
      .filter((i) => i.rejectedCartons > 0)
      .map((item) => {
        const key = `${trip.tripId}-${item.sku}-${item.batchId}`;
        const okCount =
          okSplitByItem[key] !== undefined
            ? okSplitByItem[key]
            : Math.max(0, item.rejectedCartons - 1);
        const brokenCount = item.rejectedCartons - okCount;
        return {
          sku: item.sku,
          batchId: item.batchId,
          checkedOkToAvailable: okCount,
          checkedBrokenToDamaged: brokenCount,
        };
      });

    const res = onProcessGateInSrn({
      tripId,
      inspections,
      notes: `Storekeeper Gate-In inspection completed for ${trip.vanPlate}.`,
    });

    if (res.error) {
      setSrnError(res.error);
      return;
    }

    if (res.voucher) {
      setSrnBanner(res.voucher);
    }
  };

  const handleBlindCycleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const prod =
      state.products.find((p) => p.sku === cycleSku) || state.products[0];
    const batch = prod.batches[0];
    const res = onPerformBlindCycleCount({
      sku: prod.sku,
      batchId: batch.batchId,
      countedCartons: parseInt(cycleCountedCartons, 10) || 0,
      countedLoosePieces: parseInt(cycleCountedLoose, 10) || 0,
    });
    if (res.record) {
      setLatestCycleRecord(res.record);
    }
  };

  const verifyingTrip = state.trips.find((t) => t.tripId === verifyingTripId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="rounded-xl bg-white border border-slate-200 p-5">
        <p className="text-xs font-semibold text-emerald-800">
          SCREEN 6 · GATE-IN RETURNS (SRN), 5:00 PM EVENING SETTLEMENT & MANAGER WRITE-OFFS
          (SR-08, SR-09, SR-10)
        </p>
        <h1 className="text-xl font-bold text-slate-900 mt-0.5">
          Gate-In Returns (SRN), Accountant 5:00 PM Settlement & Damaged Write-Offs (ADJ)
        </h1>
        <p className="text-xs text-slate-600 mt-0.5">
          Three end-of-day control gates: Storekeeper Gate-In Return Inspection, Accountant 5:00 PM
          Reconciliation, and Owner/Manager Damaged Stock Write-Off.
        </p>
      </div>

      {/* PART A: Storekeeper Gate-In Return Check (SRN — SR-08) */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-orange-600" />
              <span>
                Part A: Storekeeper Gate-In Return Check (SRN — Pending Return Bucket Inspection)
              </span>
            </h2>
            <p className="text-xs text-slate-600">
              Vans returning with rejected boxes are locked until the Storekeeper splits them into
              Checked OK (→ Available) or Checked Broken (→ Damaged).
            </p>
          </div>
          <span className="font-mono text-xs font-bold text-orange-700">
            {pendingReturnTrips.length} Van(s) Waiting at Kality Gate
          </span>
        </div>

        {srnError && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800">
            {srnError}
          </div>
        )}

        {srnBanner && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-emerald-950 space-y-0.5">
              <div className="font-bold flex items-center gap-1.5">
                <Unlock className="w-4 h-4 text-emerald-700" />
                <span>
                  Store Return Note Issued ({srnBanner.voucherId}) — Driver Trip Unlocked!
                </span>
              </div>
              <p className="text-emerald-800 font-mono">{srnBanner.notes}</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenVoucher(srnBanner)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#065F46] text-white text-xs font-semibold"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Print {srnBanner.voucherId}</span>
            </button>
          </div>
        )}

        {pendingReturnTrips.length === 0 ? (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600">
            All returning delivery vans have been inspected and cleared via Store Return Notes
            (SRN).
          </div>
        ) : (
          <div className="space-y-4">
            {pendingReturnTrips.map((trip) => (
              <div
                key={trip.tripId}
                className="rounded-lg bg-orange-50/50 border-2 border-orange-300 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {trip.tripId} · Driver {trip.driverName} (Van {trip.vanPlate})
                    </span>
                    <div className="text-xs text-slate-600">
                      Returned from: <strong>{trip.shopNameEn}</strong> · Morning SIV:{' '}
                      <span className="font-mono">{trip.sivVoucherId}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-orange-800">
                    <Lock className="w-3.5 h-3.5" />
                    <span>TRIP LOCKED AT GATE</span>
                  </span>
                </div>

                {trip.items
                  .filter((i) => i.rejectedCartons > 0)
                  .map((item) => {
                    const key = `${trip.tripId}-${item.sku}-${item.batchId}`;
                    const okCount =
                      okSplitByItem[key] !== undefined
                        ? okSplitByItem[key]
                        : Math.max(0, item.rejectedCartons - 1);
                    const brokenCount = item.rejectedCartons - okCount;

                    return (
                      <div
                        key={key}
                        className="rounded-lg bg-white border border-orange-200 p-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-xs"
                      >
                        <div className="md:col-span-5">
                          <div className="font-bold text-slate-900">
                            {item.productNameEn} (Batch {item.lotNumber})
                          </div>
                          <div className="text-orange-800 font-semibold mt-0.5">
                            Pending Return: {item.rejectedCartons} Cartons · Reason:{' '}
                            {item.rejectionReason || 'Shop Refusal'}
                          </div>
                        </div>

                        <div className="md:col-span-3">
                          <label className="block text-[11px] font-semibold text-emerald-800 mb-1">
                            Checked OK (→ Back to Available)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={item.rejectedCartons}
                            value={okCount}
                            onChange={(e) => {
                              const val = Math.min(
                                item.rejectedCartons,
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              );
                              setOkSplitByItem((prev) => ({ ...prev, [key]: val }));
                            }}
                            aria-label={`Checked OK cartons for ${item.productNameEn}`}
                            className="w-full rounded border border-emerald-300 px-2.5 py-1.5 font-mono font-bold text-emerald-900"
                          />
                        </div>

                        <div className="md:col-span-3">
                          <label className="block text-[11px] font-semibold text-rose-800 mb-1">
                            Checked Broken (→ Move to Damaged)
                          </label>
                          <input
                            type="number"
                            readOnly
                            value={brokenCount}
                            aria-label={`Checked Broken cartons for ${item.productNameEn}`}
                            className="w-full rounded border border-rose-200 bg-rose-50 px-2.5 py-1.5 font-mono font-bold text-rose-900"
                          />
                        </div>

                        <div className="md:col-span-1 text-right font-mono font-bold text-slate-700">
                          = {item.rejectedCartons} Ctn
                        </div>
                      </div>
                    );
                  })}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleIssueSrn(trip.tripId)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#065F46] hover:bg-[#047857] text-white text-xs font-bold transition-colors"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Complete Gate-In Check, Issue SRN & Unlock Trip</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PART B: Accountant 5:00 PM Evening Settlement Table (SR-09) */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-700" />
              <span>
                Part B: Accountant 5:00 PM Evening Settlement Table (SR-09 Reconciliation)
              </span>
            </h2>
            <p className="text-xs text-slate-600">
              Reconciles every morning Store Issue Voucher (SIV) against Delivered & Sold PoDs,
              links.et verified transfers, synced offline references, and Gate-In SRNs.
            </p>
          </div>
          <span className="font-mono text-xs font-semibold text-slate-600">
            Settlement Cutoff: 17:00 EAT
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <th className="py-2.5 px-3">Trip & Morning SIV</th>
                <th className="py-2.5 px-3">Driver & B2B Shop</th>
                <th className="py-2.5 px-3 text-right">Loaded → Sold / Returned</th>
                <th className="py-2.5 px-3 text-right">Deposit + Doorstep Collected</th>
                <th className="py-2.5 px-3">Payment Ref & Gate-In SRN</th>
                <th className="py-2.5 px-3 text-right">5:00 PM Settlement Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {state.trips.map((trip) => {
                const loadedCtn = trip.items.reduce((a, b) => a + b.loadedCartons, 0);
                const soldCtn = trip.items.reduce((a, b) => a + b.acceptedCartons, 0);
                const rejCtn = trip.items.reduce((a, b) => a + b.rejectedCartons, 0);

                return (
                  <tr key={trip.tripId} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono">
                      <div className="font-bold text-slate-900">{trip.tripId}</div>
                      <div className="text-emerald-800 font-semibold">{trip.sivVoucherId}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{trip.shopNameEn}</div>
                      <div className="text-slate-500 text-[11px]">
                        Driver {trip.driverName} ({trip.vanPlate})
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      <div>Loaded: {loadedCtn} Ctn</div>
                      <div className="text-emerald-800 font-bold">
                        Sold: {trip.stopStatus === 'Out for Delivery' ? 'In Transit' : `${soldCtn} Ctn`}
                      </div>
                      {rejCtn > 0 && (
                        <div className="text-orange-700 font-semibold">
                          Returned: {rejCtn} Ctn
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      <div className="text-slate-500">
                        Deposit: ETB {trip.depositAlreadyPaidEtb.toLocaleString()}
                      </div>
                      <div className="font-bold text-slate-900">
                        Doorstep: ETB {trip.balanceCollectedEtb.toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      <div>
                        {trip.paymentMethod}:{' '}
                        <strong>{trip.paymentReferenceNumber || 'Pending Doorstep'}</strong>
                      </div>
                      {trip.srnVoucherId ? (
                        <div className="text-emerald-800 font-bold">
                          Gate SRN: {trip.srnVoucherId}
                        </div>
                      ) : rejCtn > 0 ? (
                        <div className="text-orange-700 font-bold">
                          Awaiting Gate SRN Lock
                        </div>
                      ) : (
                        <div className="text-slate-500">No Returns (0 Rejected)</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {trip.settledByAccountant ? (
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Settled ({trip.settledAt})</span>
                        </span>
                      ) : !trip.tripClosed ? (
                        <span className="text-[11px] font-mono text-amber-800 font-semibold">
                          Complete Delivery / Gate SRN First
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setVerifyingTripId(trip.tripId)}
                            className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-emerald-50 text-emerald-900 border border-slate-300 font-semibold text-[11px]"
                          >
                            links.et Check
                          </button>
                          <button
                            type="button"
                            onClick={() => onSettleTripByAccountant(trip.tripId)}
                            className="px-3 py-1.5 rounded bg-[#065F46] hover:bg-[#047857] text-white font-bold text-xs"
                          >
                            Close 5PM Settlement
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PART C: Blind Shelf Cycle Count & Manager Write-Off Approval (SR-10 & NFR-03) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blind Shelf Cycle Count (SR-04 / SR-10) */}
        <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-amber-600" />
              <span>Part C1: Storekeeper Blind Shelf Cycle Count (SR-04 / SR-10)</span>
            </h2>
            <p className="text-xs text-slate-600">
              System hides expected shelf balance until Storekeeper enters physical carton count.
            </p>
          </div>

          <form onSubmit={handleBlindCycleSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="cycle-sku-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Select Shelf SKU & Batch to Count
              </label>
              <select
                id="cycle-sku-select"
                value={cycleSku}
                onChange={(e) => {
                  setCycleSku(e.target.value);
                  setLatestCycleRecord(null);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
              >
                {state.products.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.sku} — {p.nameEn} (Bin {p.batches[0].binCode}, Batch{' '}
                    {p.batches[0].lotNumber}) [Expected: *** Hidden]
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="cycle-cartons"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Physical Counted Cartons
                </label>
                <input
                  id="cycle-cartons"
                  type="number"
                  min={0}
                  value={cycleCountedCartons}
                  onChange={(e) => setCycleCountedCartons(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono font-bold"
                />
              </div>
              <div>
                <label
                  htmlFor="cycle-loose"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Physical Loose Pieces
                </label>
                <input
                  id="cycle-loose"
                  type="number"
                  min={0}
                  value={cycleCountedLoose}
                  onChange={(e) => setCycleCountedLoose(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
            >
              Submit Blind Shelf Count & Reveal Expected Balance
            </button>
          </form>

          {latestCycleRecord && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 text-xs font-mono space-y-1">
              <div className="font-bold text-slate-900">
                Blind Cycle Count Result ({latestCycleRecord.countId}):
              </div>
              <div>
                Physical Count: <strong>{latestCycleRecord.countedCartons} Ctn</strong> | Revealed
                Expected Available: <strong>{latestCycleRecord.expectedAvailableCartons} Ctn</strong>
              </div>
              <div
                className={
                  latestCycleRecord.varianceCartons === 0
                    ? 'text-emerald-700 font-bold'
                    : 'text-amber-800 font-bold'
                }
              >
                Variance: {latestCycleRecord.varianceCartons >= 0 ? '+' : ''}
                {latestCycleRecord.varianceCartons} Ctn ({latestCycleRecord.status})
              </div>
            </div>
          )}
        </div>

        {/* Manager Write-Off Approval (ADJ — SR-10, NFR-03) */}
        <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>
                  Part C2: Owner / Manager Damaged Stock Write-Off Approval (ADJ — SR-10)
                </span>
              </h2>
              <p className="text-xs text-slate-600">
                Role Security (NFR-03): Storekeeper cannot approve write-offs. Only Owner / Manager
                can issue an ADJ voucher.
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-slate-700">
              Active Role: {state.currentRole}
            </span>
          </div>

          {state.currentRole !== 'Owner / Manager' && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-center justify-between gap-2 text-xs">
              <span className="text-amber-900">
                You are currently viewing as <strong>{state.currentRole}</strong>. Switch to{' '}
                <strong>Owner / Manager</strong> to approve write-offs.
              </span>
              <button
                type="button"
                onClick={() => onSwitchRole('Owner / Manager')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-900 text-white font-semibold whitespace-nowrap shrink-0"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Switch to Owner / Manager</span>
              </button>
            </div>
          )}

          {adjError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{adjError}</span>
            </div>
          )}

          {adjBanner && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-3.5 flex items-center justify-between gap-2 text-xs">
              <div className="font-bold text-emerald-950">
                Write-Off Approved ({adjBanner.voucherId}) & Logged to Digital Bin Card!
              </div>
              <button
                type="button"
                onClick={() => onOpenVoucher(adjBanner)}
                className="px-3 py-1.5 rounded bg-[#065F46] text-white font-semibold"
              >
                Print {adjBanner.voucherId}
              </button>
            </div>
          )}

          {damagedBatches.length === 0 ? (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600">
              Zero cartons currently in the Damaged bucket. All write-offs completed!
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Manager Write-Off Audit Reason
                </label>
                <input
                  type="text"
                  value={writeOffReason}
                  onChange={(e) => setWriteOffReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                />
              </div>

              {damagedBatches.map(({ product, batch }) => (
                <div
                  key={batch.batchId}
                  className="rounded-lg bg-rose-50/50 border border-rose-200 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      {product.nameEn} ({product.sku})
                    </div>
                    <div className="font-mono text-rose-800 font-semibold">
                      Batch {batch.lotNumber} · Damaged Bucket: {batch.buckets.Damaged} Cartons
                      (Value: ETB{' '}
                      {(batch.buckets.Damaged * product.pricePerCartonEtb).toLocaleString()})
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjError(null);
                      const res = onApproveDamagedWriteOff({
                        sku: product.sku,
                        batchId: batch.batchId,
                        cartonsToWriteOff: batch.buckets.Damaged,
                        reason: writeOffReason,
                      });
                      if (res.error) {
                        setAdjError(res.error);
                      } else if (res.voucher) {
                        setAdjBanner(res.voucher);
                      }
                    }}
                    className="px-3.5 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold transition-colors whitespace-nowrap"
                  >
                    Approve Write-Off (ADJ) — {batch.buckets.Damaged} Ctn
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* links.et Modal for 5:00 PM Settlement Verification */}
      {verifyingTrip && (
        <LinksEtVerifierModal
          isOpen={Boolean(verifyingTrip)}
          onClose={() => setVerifyingTripId(null)}
          apiConfig={state.apiConfig}
          referenceNumber={verifyingTrip.paymentReferenceNumber || 'TB2610267710'}
          expectedAmountEtb={verifyingTrip.balanceCollectedEtb}
          payerHintName={verifyingTrip.shopNameEn}
          paymentChannel={verifyingTrip.paymentMethod}
          onVerifiedSuccess={() => {
            onSettleTripByAccountant(verifyingTrip.tripId);
          }}
        />
      )}
    </div>
  );
};
