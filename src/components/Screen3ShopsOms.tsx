import React, { useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Lock,
  MapPin,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  HubState,
  PaymentChannel,
  ShopOrder,
  ShopProfile,
  interfaceLinksEtVerificationPayload,
} from '../types/domain';
import {
  allocateFefoBatches,
  evaluateOrderCommitment,
  getProductStockSummary,
} from '../utils/businessRules';
import { AddisMapCanvas } from './AddisMapCanvas';
import { LinksEtVerifierModal } from './LinksEtVerifierModal';

interface Screen3ShopsOmsProps {
  state: HubState;
  onCreateOrder: (params: {
    shopId: string;
    gpsLat: number;
    gpsLng: number;
    lines: { sku: string; cartons: number; loosePieces?: number }[];
    depositReferenceNumber?: string;
    depositPaymentChannel?: PaymentChannel;
    managerOverrideCredit?: boolean;
  }) => { createdOrder?: ShopOrder; error?: string };
  onConfirmOrderDeposit: (
    orderId: string,
    ref: string,
    viaLinksEt: boolean,
    payload?: interfaceLinksEtVerificationPayload
  ) => void;
  onUpdateShopPolicy: (shopId: string, depositPct: number, creditLimitEtb: number) => void;
}

export const Screen3ShopsOms: React.FC<Screen3ShopsOmsProps> = ({
  state,
  onCreateOrder,
  onConfirmOrderDeposit,
  onUpdateShopPolicy,
}) => {
  const [selectedShopId, setSelectedShopId] = useState<string>('SHOP-02');
  const selectedShop: ShopProfile =
    state.shops.find((s) => s.shopId === selectedShopId) || state.shops[0];

  const [gpsLat, setGpsLat] = useState<number>(selectedShop.gpsLat);
  const [gpsLng, setGpsLng] = useState<number>(selectedShop.gpsLng);
  const [telegramCoordInput, setTelegramCoordInput] = useState<string>('');
  const [orderLines, setOrderLines] = useState<
    { sku: string; cartons: number; loosePieces: number }[]
  >([{ sku: 'SKU-OIL-01', cartons: 10, loosePieces: 0 }]);

  const [depositRefInput, setDepositRefInput] = useState<string>('TB2610265519');
  const [depositChannel, setDepositChannel] = useState<PaymentChannel>('Telebirr');
  const [managerOverrideCredit, setManagerOverrideCredit] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Links.et verifier modal state for existing orders
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);
  const [refInputsByOrder, setRefInputsByOrder] = useState<Record<string, string>>({});

  const handleSelectShop = (shop: ShopProfile) => {
    setSelectedShopId(shop.shopId);
    setGpsLat(shop.gpsLat);
    setGpsLng(shop.gpsLng);
    setFormError(null);
    setFormSuccess(null);
  };

  const handleParseTelegramCoords = () => {
    const parts = telegramCoordInput
      .replace(/[^0-9.,-]/g, ' ')
      .trim()
      .split(/[\s,]+/);
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setGpsLat(Number(lat.toFixed(4)));
        setGpsLng(Number(lng.toFixed(4)));
      }
    }
  };

  // Live calculation of order total & commitment preview
  let draftOrderTotalEtb = 0;
  let stockOverrunWarning: string | null = null;

  for (const line of orderLines) {
    const prod = state.products.find((p) => p.sku === line.sku);
    if (!prod) continue;
    draftOrderTotalEtb += line.cartons * prod.pricePerCartonEtb;
    const summary = getProductStockSummary(prod);
    if (line.cartons > summary.Available) {
      stockOverrunWarning = `Live Stock Check (SR-02): Requested ${line.cartons} Ctn of ${prod.nameEn}, but only ${summary.Available} Ctn are Available! Order is blocked.`;
    }
  }

  const commitmentPreview = evaluateOrderCommitment(
    selectedShop,
    draftOrderTotalEtb,
    managerOverrideCredit
  );

  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (stockOverrunWarning) {
      setFormError(stockOverrunWarning);
      return;
    }

    const res = onCreateOrder({
      shopId: selectedShop.shopId,
      gpsLat,
      gpsLng,
      lines: orderLines,
      depositReferenceNumber: depositRefInput,
      depositPaymentChannel: depositChannel,
      managerOverrideCredit,
    });

    if (res.error) {
      setFormError(res.error);
      return;
    }

    if (res.createdOrder) {
      setFormSuccess(
        `Order ${res.createdOrder.orderId} created with status "${res.createdOrder.status}". ${res.createdOrder.commitmentReason}`
      );
    }
  };

  const verifyingOrder = state.orders.find((o) => o.orderId === verifyingOrderId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="rounded-xl bg-white border border-slate-200 p-5">
        <p className="text-xs font-semibold text-emerald-800">
          SCREEN 3 · BOLE SALES OFFICE & FINANCE · SMART ORDER COMMITMENT ENGINE (SR-01, SR-02,
          SR-12)
        </p>
        <h1 className="text-xl font-bold text-slate-900 mt-0.5">
          B2B Shops Directory & Smart Order Commitment Gate (OMS)
        </h1>
        <p className="text-xs text-slate-600 mt-0.5">
          We sell strictly to B2B Shops. Orders from New Shops or Shops with Past Refusals are held
          in "Awaiting Deposit Approval" until verified via links.et API or Accountant approval.
        </p>
      </div>

      {/* B2B Shop Profiles Directory (SR-12) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {state.shops.map((shop) => {
          const isSelected = shop.shopId === selectedShop.shopId;
          return (
            <div
              key={shop.shopId}
              onClick={() => handleSelectShop(shop)}
              className={`rounded-xl border p-4 cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                isSelected
                  ? 'bg-emerald-50/40 border-2 border-[#065F46]'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[11px] font-bold text-emerald-800">
                      {shop.shopId}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{shop.nameEn}</h3>
                    <p className="text-xs text-slate-500">{shop.nameAm}</p>
                  </div>
                </div>

                {/* Unboxed Category Metadata */}
                <div className="text-xs pt-1 border-t border-slate-200/80 space-y-1">
                  <div className="font-semibold text-slate-900">
                    Category:{' '}
                    <span
                      className={
                        shop.shopCategory === 'Regular Trusted Shop'
                          ? 'text-emerald-700'
                          : shop.shopCategory === 'Credit Shop'
                          ? 'text-blue-700'
                          : 'text-amber-700'
                      }
                    >
                      {shop.shopCategory}
                    </span>
                  </div>
                  <div className="text-slate-600 font-mono text-[11px]">
                    Completed: {shop.completedOrdersCount} · Past Refusals: {shop.pastRefusalCount}
                  </div>
                  {shop.shopCategory === 'Credit Shop' ? (
                    <div className="text-slate-700 font-mono text-[11px]">
                      Credit Used: ETB {shop.currentBalanceEtb.toLocaleString()} /{' '}
                      {shop.creditLimitEtb.toLocaleString()}
                    </div>
                  ) : (
                    <div className="text-slate-700 font-mono text-[11px]">
                      Required Deposit: <strong>{shop.requiredDepositPct}%</strong>
                    </div>
                  )}
                  <div className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>
                      GPS: {shop.gpsLat}, {shop.gpsLng} ({shop.phoneMasked})
                    </span>
                  </div>
                </div>
              </div>

              {/* Manager Policy Controls (if Owner / Manager role is active) */}
              {state.currentRole === 'Owner / Manager' && (
                <div
                  className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2 text-[11px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label className="font-semibold text-slate-700">
                    Manager Deposit %:
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={shop.requiredDepositPct}
                      onChange={(e) =>
                        onUpdateShopPolicy(
                          shop.shopId,
                          Number(e.target.value) || 0,
                          shop.creditLimitEtb
                        )
                      }
                      className="ml-1.5 w-14 rounded border border-slate-300 px-1.5 py-0.5 font-mono text-xs bg-white"
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Split Layout: Left = New B2B Order & Commitment Check Form | Right = Active Order Queue & Deposit Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: New Order Form + Interactive Addis Ababa GPS Map */}
        <form
          onSubmit={handleCreateOrderSubmit}
          className="lg:col-span-7 rounded-xl bg-white border border-slate-200 p-5 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-700" />
                <span>Create B2B Wholesale Order — {selectedShop.nameEn}</span>
              </h2>
              <p className="text-xs text-slate-500">
                Select shop above, verify Addis Ababa GPS delivery pin, and add carton quantities.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-800">
              {selectedShop.shopCategory}
            </span>
          </div>

          {/* Step 1: GPS Pin Picker & Telegram Coordinate Paste */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800">
                1. Confirm Shop GPS Delivery Pin (Click Map or Paste Telegram Coordinates)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={telegramCoordInput}
                  onChange={(e) => setTelegramCoordInput(e.target.value)}
                  placeholder="Paste e.g. 9.0301, 38.7369"
                  aria-label="Paste Telegram GPS coordinates"
                  className="rounded border border-slate-300 px-2.5 py-1 text-xs font-mono w-44"
                />
                <button
                  type="button"
                  onClick={handleParseTelegramCoords}
                  className="px-2.5 py-1 rounded bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700"
                >
                  Apply Pin
                </button>
              </div>
            </div>

            <AddisMapCanvas
              googleMapsApiKey={state.apiConfig.googleMapsApiKey}
              selectedLat={gpsLat}
              selectedLng={gpsLng}
              selectedLabel={`${selectedShop.nameEn} — ${selectedShop.landmarkNote}`}
              onSelectCoordinates={(lat, lng) => {
                setGpsLat(lat);
                setGpsLng(lng);
              }}
              heightClass="h-56"
            />
          </div>

          {/* Step 2: Order Line Items with Live Stock Check (SR-02) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                2. Order Line Items (Live Available Stock Check & FEFO Batch Preview)
              </label>
              <button
                type="button"
                onClick={() =>
                  setOrderLines((prev) => [
                    ...prev,
                    { sku: 'SKU-DET-02', cartons: 5, loosePieces: 0 },
                  ])
                }
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product Line</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {orderLines.map((line, index) => {
                const prod =
                  state.products.find((p) => p.sku === line.sku) || state.products[0];
                const stockSum = getProductStockSummary(prod);
                const fefoAlloc = allocateFefoBatches(prod, line.cartons);

                return (
                  <div
                    key={index}
                    className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Product (Available: {stockSum.Available} Cartons)
                        </label>
                        <select
                          value={line.sku}
                          onChange={(e) => {
                            const next = [...orderLines];
                            next[index].sku = e.target.value;
                            setOrderLines(next);
                          }}
                          aria-label={`Select product for line ${index + 1}`}
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                        >
                          {state.products.map((p) => {
                            const s = getProductStockSummary(p);
                            return (
                              <option key={p.sku} value={p.sku}>
                                {p.sku} — {p.nameEn} (Avl: {s.Available} Ctn · ETB{' '}
                                {p.pricePerCartonEtb}/Ctn)
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Cartons ({prod.unitLabelEn})
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={line.cartons}
                          onChange={(e) => {
                            const next = [...orderLines];
                            next[index].cartons = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setOrderLines(next);
                          }}
                          aria-label={`Cartons for line ${index + 1}`}
                          className={`w-full rounded border px-2.5 py-1.5 text-xs font-mono font-bold ${
                            line.cartons > stockSum.Available
                              ? 'border-rose-500 bg-rose-50 text-rose-900'
                              : 'border-slate-300 bg-white'
                          }`}
                        />
                      </div>

                      <div className="sm:col-span-2 text-right font-mono text-xs font-bold text-slate-900 py-1.5">
                        ETB {(line.cartons * prod.pricePerCartonEtb).toLocaleString()}
                      </div>

                      <div className="sm:col-span-1 flex justify-end">
                        {orderLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setOrderLines(orderLines.filter((_, i) => i !== index))
                            }
                            aria-label={`Remove line ${index + 1}`}
                            className="p-1.5 rounded text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* FEFO Allocation Preview */}
                    <div className="text-[11px] font-mono text-slate-600 flex flex-wrap items-center gap-2">
                      {fefoAlloc.canFulfill ? (
                        <>
                          <span className="text-emerald-800 font-semibold">
                            FEFO Auto-Lock (SR-03):
                          </span>
                          {fefoAlloc.allocations.map((a) => (
                            <span key={a.batchId} className="text-slate-700">
                              {a.cartonsAllocated} Ctn from <strong>{a.lotNumber}</strong> (Bin{' '}
                              {a.binCode}, Exp {a.expiryDate})
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="text-rose-700 font-semibold">
                          Exceeds Available Stock ({stockSum.Available} Cartons max)!
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 3: Automatic Order Commitment Gate Preview (SR-01) */}
          <div
            className={`rounded-lg border p-4 space-y-3 ${
              commitmentPreview.status === 'Confirmed'
                ? 'bg-emerald-50/60 border-emerald-300'
                : 'bg-amber-50/70 border-amber-300'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                {commitmentPreview.status === 'Confirmed' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                ) : (
                  <Lock className="w-4 h-4 text-amber-700" />
                )}
                <span>
                  3. Order Commitment Gate Outcome: "{commitmentPreview.status}"
                </span>
              </div>
              <span className="font-mono text-sm font-bold text-slate-900">
                Total: ETB {draftOrderTotalEtb.toLocaleString()}
              </span>
            </div>

            <p className="text-xs text-slate-700">{commitmentPreview.reason}</p>

            {commitmentPreview.status === 'Awaiting Deposit Approval' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Deposit Channel ({commitmentPreview.requiredDepositPct}% = ETB{' '}
                    {commitmentPreview.requiredDepositEtb.toLocaleString()})
                  </label>
                  <select
                    value={depositChannel}
                    onChange={(e) => setDepositChannel(e.target.value as PaymentChannel)}
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="Telebirr">Telebirr</option>
                    <option value="CBE Birr">CBE Birr</option>
                    <option value="CBE Mobile Banking">CBE Mobile Banking</option>
                    <option value="Awash / Dashen via EthSwitch">
                      Awash / Dashen via EthSwitch
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Customer Deposit SMS / Transaction Reference
                  </label>
                  <input
                    type="text"
                    value={depositRefInput}
                    onChange={(e) => setDepositRefInput(e.target.value)}
                    placeholder="e.g. TB2610269941"
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {selectedShop.shopCategory === 'Credit Shop' &&
              state.currentRole === 'Owner / Manager' && (
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 pt-1">
                  <input
                    type="checkbox"
                    checked={managerOverrideCredit}
                    onChange={(e) => setManagerOverrideCredit(e.target.checked)}
                  />
                  <span>Owner / Manager Override: Approve Credit Limit Exceeded</span>
                </label>
              )}
          </div>

          {formError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-semibold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>{formSuccess}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={Boolean(stockOverrunWarning)}
              className="px-5 py-2.5 rounded-lg bg-[#065F46] hover:bg-[#047857] disabled:bg-slate-300 text-white text-xs font-bold transition-colors"
            >
              Submit B2B Order & Run Commitment Gate
            </button>
          </div>
        </form>

        {/* Right 5 Columns: Order Commitment Queue & Accountant / links.et Deposit Verification */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  <span>B2B Orders & Deposit Verification Queue</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Orders in "Awaiting Deposit Approval" cannot be packed until verified below.
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-slate-700">
                {state.orders.length} Orders
              </span>
            </div>

            <div className="space-y-3">
              {state.orders.map((ord) => {
                const isAwaiting = ord.status === 'Awaiting Deposit Approval';
                const currentRef =
                  refInputsByOrder[ord.orderId] !== undefined
                    ? refInputsByOrder[ord.orderId]
                    : ord.depositReferenceNumber || 'TB2610269941';

                return (
                  <div
                    key={ord.orderId}
                    className={`rounded-lg border p-4 space-y-2.5 ${
                      isAwaiting
                        ? 'bg-amber-50/50 border-amber-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {ord.orderId}
                        </span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="text-xs font-bold text-slate-900">{ord.shopNameEn}</span>
                        <div className="text-[11px] text-slate-500">
                          {ord.shopCategory} · GPS: {ord.gpsLat}, {ord.gpsLng}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold ${
                          isAwaiting ? 'text-amber-800' : 'text-emerald-800'
                        }`}
                      >
                        {ord.status}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-slate-700 space-y-0.5">
                      {ord.items.map((it, idx) => (
                        <div key={idx}>
                          • {it.cartons} Ctn × {it.productNameEn} = ETB{' '}
                          {it.lineTotalEtb.toLocaleString()}
                        </div>
                      ))}
                      <div className="font-bold text-slate-900 pt-1">
                        Order Total: ETB {ord.totalAmountEtb.toLocaleString()}
                        {ord.requiredDepositEtb > 0 &&
                          ` | Required Deposit (${ord.requiredDepositPct}%): ETB ${ord.requiredDepositEtb.toLocaleString()}`}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {ord.commitmentReason}
                    </p>

                    {isAwaiting && (
                      <div className="pt-2 border-t border-amber-200 space-y-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                            Telebirr / Bank Deposit Reference Number
                          </label>
                          <input
                            type="text"
                            value={currentRef}
                            onChange={(e) =>
                              setRefInputsByOrder((prev) => ({
                                ...prev,
                                [ord.orderId]: e.target.value,
                              }))
                            }
                            aria-label={`Deposit reference for ${ord.orderId}`}
                            className="w-full rounded border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-mono font-bold"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setVerifyingOrderId(ord.orderId)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#065F46] hover:bg-[#047857] text-white text-xs font-semibold transition-colors"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Verify via links.et API</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onConfirmOrderDeposit(ord.orderId, currentRef, false)
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold transition-colors"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Accountant Manual Approval</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* links.et API Verifier Modal */}
      {verifyingOrder && (
        <LinksEtVerifierModal
          isOpen={Boolean(verifyingOrder)}
          onClose={() => setVerifyingOrderId(null)}
          apiConfig={state.apiConfig}
          referenceNumber={
            refInputsByOrder[verifyingOrder.orderId] ||
            verifyingOrder.depositReferenceNumber ||
            'TB2610269941'
          }
          expectedAmountEtb={verifyingOrder.requiredDepositEtb}
          payerHintName={verifyingOrder.shopNameEn}
          paymentChannel={verifyingOrder.depositPaymentChannel}
          onVerifiedSuccess={(payload) =>
            onConfirmOrderDeposit(
              verifyingOrder.orderId,
              payload.referenceNumber,
              true,
              payload
            )
          }
        />
      )}
    </div>
  );
};
