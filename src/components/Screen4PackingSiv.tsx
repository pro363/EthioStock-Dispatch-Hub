import React, { useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Lock,
  PackageCheck,
  Truck,
  ArrowRight,
} from 'lucide-react';
import { DeliveryTrip, HubState, PrintableVoucher } from '../types/domain';

interface Screen4PackingSivProps {
  state: HubState;
  onPackAndIssueSiv: (params: {
    orderId: string;
    driverName: string;
    driverPhone: string;
    vanPlate: string;
  }) => { voucher?: PrintableVoucher; trip?: DeliveryTrip; error?: string };
  onOpenVoucher: (voucher: PrintableVoucher) => void;
  onNavigateScreen: (screenIndex: number) => void;
}

const AVAILABLE_VANS = [
  {
    driverName: 'Dawit Mekonnen',
    driverPhone: '+251 911 552 109',
    vanPlate: 'AA-3-B48291 (Isuzu NPR Box Van)',
    cleanPlate: 'AA-3-B48291',
  },
  {
    driverName: 'Tewodros Bekele',
    driverPhone: '+251 911 888 221',
    vanPlate: 'AA-3-B90112 (Toyota Hilux Cargo)',
    cleanPlate: 'AA-3-B90112',
  },
  {
    driverName: 'Mulugeta Kassahun',
    driverPhone: '+251 912 319 400',
    vanPlate: 'ET-3-77410 (Mitsubishi Canter)',
    cleanPlate: 'ET-3-77410',
  },
];

export const Screen4PackingSiv: React.FC<Screen4PackingSivProps> = ({
  state,
  onPackAndIssueSiv,
  onOpenVoucher,
  onNavigateScreen,
}) => {
  const [selectedVanIdxByOrder, setSelectedVanIdxByOrder] = useState<Record<string, number>>({});
  const [recentSivBanner, setRecentSivBanner] = useState<{
    orderId: string;
    voucher: PrintableVoucher;
    trip: DeliveryTrip;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const confirmedOrders = state.orders.filter((o) => o.status === 'Confirmed');
  const blockedOrders = state.orders.filter((o) => o.status === 'Awaiting Deposit Approval');
  const dispatchedOrders = state.orders.filter(
    (o) =>
      o.status === 'On the Van (SIV Issued)' ||
      o.status === 'Delivered & Settled' ||
      o.status === 'Partially Delivered (Pending Return)'
  );

  const handlePackOrder = (orderId: string) => {
    setErrorMsg(null);
    const vanIdx = selectedVanIdxByOrder[orderId] ?? 0;
    const van = AVAILABLE_VANS[vanIdx] || AVAILABLE_VANS[0];

    const res = onPackAndIssueSiv({
      orderId,
      driverName: van.driverName,
      driverPhone: van.driverPhone,
      vanPlate: van.cleanPlate,
    });

    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    if (res.voucher && res.trip) {
      setRecentSivBanner({
        orderId,
        voucher: res.voucher,
        trip: res.trip,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-800">
            SCREEN 4 · KALITY CENTRAL WAREHOUSE · FEFO PICKING & VAN DISPATCH (SR-03, SR-05)
          </p>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            Warehouse Packing & Store Issue Voucher (SIV) Dispatch
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Lists strictly "Confirmed" orders. Instructs the Storekeeper which exact Shelf Bin and
            Oldest Batch (FEFO) to pick from, then moves stock from Reserved to On the Van.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-emerald-800 font-bold">
            Ready to Pack: {confirmedOrders.length}
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-amber-700 font-bold">
            Held at Deposit Gate: {blockedOrders.length}
          </span>
        </div>
      </div>

      {/* Strict Packing Gate Reminder if any order is awaiting deposit */}
      {blockedOrders.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-amber-900">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Strict Packing Gate (SR-01 Active):</strong> {blockedOrders.length} order(s) (
              {blockedOrders.map((o) => `${o.orderId} - ${o.shopNameEn}`).join(', ')}) are withheld
              from this Pick List because their deposit is still in{' '}
              <strong>"Awaiting Deposit Approval"</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateScreen(3)}
            className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold whitespace-nowrap"
          >
            Verify Deposit on Screen 3
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-800">
          {errorMsg}
        </div>
      )}

      {recentSivBanner && (
        <div className="rounded-xl bg-emerald-50 border-2 border-emerald-600 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>
                SIV Issued ({recentSivBanner.voucher.voucherId}) — Stock Moved from Reserved to On
                the Van!
              </span>
            </div>
            <p className="text-xs text-emerald-800 font-mono">
              Order {recentSivBanner.orderId} loaded onto Van {recentSivBanner.trip.vanPlate} (Driver{' '}
              {recentSivBanner.trip.driverName}, Trip {recentSivBanner.trip.tripId}).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenVoucher(recentSivBanner.voucher)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold hover:bg-emerald-100"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Print {recentSivBanner.voucher.voucherId}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateScreen(5)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#065F46] text-white text-xs font-semibold hover:bg-[#047857]"
            >
              <span>Open Driver Mobile View (Screen 5)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Confirmed Pick List Cards */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <PackageCheck className="w-4 h-4 text-emerald-700" />
          <span>Confirmed Orders Ready for FEFO Picking & SIV Issue ({confirmedOrders.length})</span>
        </h2>

        {confirmedOrders.length === 0 ? (
          <div className="rounded-xl bg-white border border-slate-200 p-8 text-center space-y-2">
            <p className="text-sm font-bold text-slate-800">
              No Confirmed Orders Waiting in the Pick Queue
            </p>
            <p className="text-xs text-slate-500">
              Approve a pending shop deposit or create a new order on Screen 3 to populate the
              warehouse pick list.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {confirmedOrders.map((ord) => {
              const selectedVanIdx = selectedVanIdxByOrder[ord.orderId] ?? 0;

              return (
                <div
                  key={ord.orderId}
                  className="rounded-xl bg-white border border-slate-200 p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-emerald-800">
                          {ord.orderId}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-base font-bold text-slate-900">
                          {ord.shopNameEn}
                        </span>
                        <span className="text-xs text-slate-500">({ord.shopNameAm})</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{ord.commitmentReason}</p>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-xs font-bold text-emerald-800">STATUS: CONFIRMED</div>
                      <div className="text-sm font-bold text-slate-900">
                        ETB {ord.totalAmountEtb.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Mandatory FEFO Bin Picking Table (SR-03) */}
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                          <th className="py-2 px-3">Product SKU & Name</th>
                          <th className="py-2 px-3">Mandatory FEFO Batch to Pick (SR-03)</th>
                          <th className="py-2 px-3">Warehouse Shelf Bin</th>
                          <th className="py-2 px-3">Expiry Date</th>
                          <th className="py-2 px-3 text-right">Reserved Cartons to Load</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {ord.items.flatMap((item) =>
                          item.allocatedBatches.map((al) => (
                            <tr key={`${item.sku}-${al.batchId}`}>
                              <td className="py-2.5 px-3">
                                <span className="font-mono font-bold text-emerald-800 mr-1.5">
                                  {item.sku}
                                </span>
                                <span className="font-semibold text-slate-900">
                                  {item.productNameEn}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                {al.lotNumber} (Oldest Expiry First)
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-amber-800">
                                {al.binCode}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-700">
                                {al.expiryDate}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                {al.cartonsAllocated} Cartons
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Driver & Van Assignment Footer (SR-05) */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Truck className="w-4 h-4 text-slate-600" />
                      <label
                        htmlFor={`van-select-${ord.orderId}`}
                        className="text-xs font-semibold text-slate-700"
                      >
                        Assign Delivery Driver & Van:
                      </label>
                      <select
                        id={`van-select-${ord.orderId}`}
                        value={selectedVanIdx}
                        onChange={(e) =>
                          setSelectedVanIdxByOrder((prev) => ({
                            ...prev,
                            [ord.orderId]: Number(e.target.value),
                          }))
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
                      >
                        {AVAILABLE_VANS.map((v, idx) => (
                          <option key={v.cleanPlate} value={idx}>
                            Driver {v.driverName} — {v.vanPlate}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePackOrder(ord.orderId)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#065F46] hover:bg-[#047857] text-white text-xs font-bold transition-colors"
                    >
                      <PackageCheck className="w-4 h-4" />
                      <span>Pack & Issue SIV to Van (Reserved → On the Van)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Already Dispatched SIV Vouchers History */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">
          Issued Store Issue Vouchers (SIV) Today ({dispatchedOrders.length + 2})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {state.vouchers
            .filter((v) => v.voucherType === 'SIV')
            .map((v) => (
              <div
                key={v.voucherId}
                className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 flex items-center justify-between gap-3"
              >
                <div className="text-xs space-y-0.5">
                  <div className="font-mono font-bold text-slate-900">
                    {v.voucherId} · Ref {v.referenceDocId}
                  </div>
                  <div className="text-slate-600">{v.counterpartyName}</div>
                  <div className="text-[11px] font-mono text-emerald-800">
                    {v.lines.reduce((acc, l) => acc + l.cartons, 0)} Cartons moved Reserved → On
                    the Van
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenVoucher(v)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800 whitespace-nowrap"
                >
                  Print {v.voucherId}
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
