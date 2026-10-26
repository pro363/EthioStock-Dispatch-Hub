import React, { useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  EyeOff,
  FileText,
  History,
  Layers,
  PackagePlus,
  Search,
  X,
} from 'lucide-react';
import { HubState, PrintableVoucher, Product } from '../types/domain';
import {
  getFefoSortedBatches,
  getProductStockSummary,
} from '../utils/businessRules';
import { BUCKET_LABELS } from '../utils/i18n';
import { StockBucketBar } from './StockBucketBar';

interface Screen2InventoryGrnProps {
  state: HubState;
  onReceiveBlindGrn: (params: {
    poId: string;
    countedGoodCartons: number;
    countedLoosePieces: number;
    countedDamagedCartons: number;
    lotNumber: string;
    expiryDate: string;
    binCode: string;
  }) => {
    voucher?: PrintableVoucher;
    varianceCartons?: number;
    expectedCartons?: number;
    error?: string;
  };
  onOpenVoucher: (voucher: PrintableVoucher) => void;
}

export const Screen2InventoryGrn: React.FC<Screen2InventoryGrnProps> = ({
  state,
  onReceiveBlindGrn,
  onOpenVoucher,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkuForDrawer, setSelectedSkuForDrawer] = useState<string | null>('SKU-OIL-01');
  const [showGrnModal, setShowGrnModal] = useState(false);

  // Blind Receiving Form State
  const pendingPos = state.purchaseOrders.filter((p) => p.status === 'Waiting for Blind Count');
  const [selectedPoId, setSelectedPoId] = useState<string>(
    pendingPos[0]?.poId || state.purchaseOrders[0]?.poId || ''
  );
  const [countedGoodCartons, setCountedGoodCartons] = useState<string>('58');
  const [countedLoosePieces, setCountedLoosePieces] = useState<string>('0');
  const [countedDamagedCartons, setCountedDamagedCartons] = useState<string>('2');
  const [lotNumber, setLotNumber] = useState<string>('LOT-2610E');
  const [expiryDate, setExpiryDate] = useState<string>('2027-07-30');
  const [binCode, setBinCode] = useState<string>('KAL-Z1-A01-B01');
  const [grnResultBanner, setGrnResultBanner] = useState<{
    expected: number;
    countedTotal: number;
    variance: number;
    voucher?: PrintableVoucher;
  } | null>(null);
  const [grnError, setGrnError] = useState<string | null>(null);

  const lang = state.language;

  const filteredProducts = state.products.filter(
    (p) =>
      p.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nameAm.includes(searchQuery)
  );

  const drawerProduct: Product | undefined = state.products.find(
    (p) => p.sku === selectedSkuForDrawer
  );

  const selectedPo = state.purchaseOrders.find((p) => p.poId === selectedPoId);

  const handleOpenGrnModal = (poId?: string) => {
    const targetId =
      poId ||
      state.purchaseOrders.find((p) => p.status === 'Waiting for Blind Count')?.poId ||
      state.purchaseOrders[0]?.poId;
    if (targetId) {
      setSelectedPoId(targetId);
      const po = state.purchaseOrders.find((p) => p.poId === targetId);
      if (po) {
        setBinCode(po.suggestedBinCode);
      }
    }
    setGrnResultBanner(null);
    setGrnError(null);
    setShowGrnModal(true);
  };

  const handleSubmitBlindGrn = (e: React.FormEvent) => {
    e.preventDefault();
    setGrnError(null);
    const good = parseInt(countedGoodCartons, 10);
    const loose = parseInt(countedLoosePieces, 10) || 0;
    const damaged = parseInt(countedDamagedCartons, 10) || 0;

    if (isNaN(good) || good < 0) {
      setGrnError('Please enter a valid physical carton count.');
      return;
    }

    const res = onReceiveBlindGrn({
      poId: selectedPoId,
      countedGoodCartons: good,
      countedLoosePieces: loose,
      countedDamagedCartons: damaged,
      lotNumber,
      expiryDate,
      binCode,
    });

    if (res.error) {
      setGrnError(res.error);
      return;
    }

    setGrnResultBanner({
      expected: res.expectedCartons || 0,
      countedTotal: good + damaged,
      variance: res.varianceCartons || 0,
      voucher: res.voucher,
    });
  };

  return (
    <div className="space-y-6">
      {/* Screen Header & Inbound PO Blind Receiving Trigger */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-800">
            SCREEN 2 · KALITY CENTRAL WAREHOUSE · FEFO BATCHES & BLIND RECEIVING (SR-03, SR-04,
            NFR-04)
          </p>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            Warehouse Inventory, FEFO Batches & Blind Receiving (GRN)
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Click any product row to inspect its FEFO Batch Queue and permanent Digital Bin Card
            Log.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SKU or product..."
              aria-label="Search SKU or product"
              className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => handleOpenGrnModal()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#065F46] hover:bg-[#047857] text-white text-xs font-semibold transition-colors"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Blind Receiving (GRN) — {pendingPos.length} Arriving POs</span>
          </button>
        </div>
      </div>

      {/* Arriving Purchase Orders Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.purchaseOrders.map((po) => (
          <div
            key={po.poId}
            className="rounded-xl bg-white border border-slate-200 p-4 flex items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-900">{po.poId}</span>
                <span className="text-slate-300">·</span>
                <span className="text-xs font-medium text-slate-600">
                  {po.supplierName} (Truck {po.truckPlate})
                </span>
              </div>
              <div className="text-sm font-bold text-slate-900">{po.productNameEn}</div>
              <div className="text-xs text-slate-600 font-mono flex items-center gap-2">
                {po.status === 'Waiting for Blind Count' ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-amber-800 font-semibold">
                      Expected Quantity: *** Cartons (Hidden for Mandatory Blind Count SR-04)
                    </span>
                  </>
                ) : (
                  <span className="text-emerald-800 font-semibold">
                    GRN Completed ({po.grnVoucherId}) · Counted: {po.recordedGoodCartons} Good +{' '}
                    {po.recordedDamagedCartons} Damaged vs {po.expectedCartons} Expected
                  </span>
                )}
              </div>
            </div>

            {po.status === 'Waiting for Blind Count' ? (
              <button
                type="button"
                onClick={() => handleOpenGrnModal(po.poId)}
                className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                Start Blind Count
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const v = state.vouchers.find((v) => v.voucherId === po.grnVoucherId);
                  if (v) onOpenVoucher(v);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0"
              >
                View {po.grnVoucherId}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Main Inventory Table */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">SKU & Product Name (EN / አማርኛ)</th>
                <th className="py-3 px-4">Dual UoM & Price</th>
                <th className="py-3 px-4">Earliest Expiry (FEFO #1)</th>
                <th className="py-3 px-4">Primary Shelf Bin</th>
                <th className="py-3 px-4 min-w-[360px]">
                  5 Stock Buckets + Delivered & Sold Outcome
                </th>
                <th className="py-3 px-4 text-right">Bin Card</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredProducts.map((product) => {
                const summary = getProductStockSummary(product);
                const sortedBatches = getFefoSortedBatches(product);
                const fefoFirst = sortedBatches[0];
                const isSelected = selectedSkuForDrawer === product.sku;

                return (
                  <tr
                    key={product.sku}
                    onClick={() => setSelectedSkuForDrawer(product.sku)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-xs font-bold text-emerald-800">
                        {product.sku}
                      </div>
                      <div className="font-bold text-slate-900 text-sm">{product.nameEn}</div>
                      <div className="text-slate-500 text-xs">{product.nameAm}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-semibold text-slate-800">{product.unitLabelEn}</div>
                      <div className="text-slate-500 font-sans">{product.unitLabelAm}</div>
                      <div className="text-emerald-800 font-bold mt-0.5">
                        ETB {product.pricePerCartonEtb.toLocaleString()}/Ctn
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-slate-900">{fefoFirst.lotNumber}</div>
                      <div className="text-slate-600">Exp: {fefoFirst.expiryDate}</div>
                      <div
                        className={`text-[11px] font-semibold ${
                          fefoFirst.daysUntilExpiry <= 60 ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        FEFO Priority #1 ({fefoFirst.daysUntilExpiry} days)
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                      {fefoFirst.binCode}
                    </td>
                    <td className="py-3.5 px-4">
                      <StockBucketBar
                        buckets={summary}
                        deliveredAndSold={summary.deliveredAndSold}
                        lang={lang}
                        compact
                      />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSkuForDrawer(product.sku);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 whitespace-nowrap"
                      >
                        Inspect Bin Card
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Digital Bin Card Drawer & FEFO Batch Inspector (SR-03, NFR-04) */}
      {drawerProduct && (
        <div className="rounded-xl bg-white border-2 border-slate-800 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 bg-slate-900 text-white">
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold">
                Digital Bin Card & FEFO Batch Queue — {drawerProduct.sku}: {drawerProduct.nameEn}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSkuForDrawer(null)}
              aria-label="Close Digital Bin Card"
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 5 Columns: FEFO Sorted Batches */}
            <div className="lg:col-span-5 space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                FEFO Batch Queue (Sorted by Earliest Expiry First — SR-03)
              </h3>
              <div className="space-y-2.5">
                {getFefoSortedBatches(drawerProduct).map((batch, index) => (
                  <div
                    key={batch.batchId}
                    className={`rounded-lg border p-3.5 space-y-2 ${
                      index === 0
                        ? 'bg-emerald-50/40 border-emerald-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-xs font-bold text-slate-900">
                        {batch.lotNumber} · Bin {batch.binCode}
                      </div>
                      <span className="text-[11px] font-mono font-bold text-emerald-800">
                        {index === 0 ? 'FEFO PICK #1' : `FEFO PICK #${index + 1}`}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 font-mono">
                      Expiry Date: <strong>{batch.expiryDate}</strong> ({batch.daysUntilExpiry} days
                      remaining)
                    </div>
                    <StockBucketBar
                      buckets={batch.buckets}
                      deliveredAndSold={batch.deliveredAndSoldCartons}
                      lang={lang}
                      compact
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Right 7 Columns: Immutable Digital Bin Card Audit Log (NFR-04) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Immutable Digital Bin Card Log (NFR-04 — Zero Overwrite Policy)</span>
                </h3>
                <span className="text-[11px] font-mono text-slate-500">
                  Append-only cryptographic ledger
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[11px] text-slate-600">
                      <th className="py-2 px-3">When & Who</th>
                      <th className="py-2 px-3">Voucher & Batch</th>
                      <th className="py-2 px-3">Action Summary</th>
                      <th className="py-2 px-3 font-mono">Before → After (5 Buckets)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {state.binCardLog
                      .filter((l) => l.sku === drawerProduct.sku)
                      .map((entry) => (
                        <tr key={entry.entryId} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-mono text-[11px] text-slate-900 font-semibold">
                              {entry.timestamp}
                            </div>
                            <div className="text-[11px] text-slate-500">{entry.actorName}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                            <div className="font-bold text-emerald-800">{entry.voucherId}</div>
                            <div className="text-[11px] text-slate-500">{entry.lotNumber}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-800">{entry.actionSummary}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                            <div className="text-slate-500">
                              Before: Avl {entry.beforeBuckets.Available} · Res{' '}
                              {entry.beforeBuckets.Reserved} · Van{' '}
                              {entry.beforeBuckets['On the Van']} · PRet{' '}
                              {entry.beforeBuckets['Pending Return']} · Dmg{' '}
                              {entry.beforeBuckets.Damaged}
                            </div>
                            <div className="text-slate-900 font-semibold">
                              After: Avl {entry.afterBuckets.Available} · Res{' '}
                              {entry.afterBuckets.Reserved} · Van {entry.afterBuckets['On the Van']}{' '}
                              · PRet {entry.afterBuckets['Pending Return']} · Dmg{' '}
                              {entry.afterBuckets.Damaged}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Blind Receiving (GRN) Modal (SR-04) */}
      {showGrnModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="blind-grn-title"
        >
          <div className="w-full max-w-xl rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-400" />
                <h2 id="blind-grn-title" className="text-base font-bold">
                  Mandatory Blind Receiving (GRN — SR-04)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowGrnModal(false)}
                aria-label="Close Blind Receiving Modal"
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBlindGrn} className="p-6 space-y-4">
              <div>
                <label
                  htmlFor="grn-po-select"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Select Arriving Supplier Purchase Order (PO)
                </label>
                <select
                  id="grn-po-select"
                  value={selectedPoId}
                  onChange={(e) => {
                    setSelectedPoId(e.target.value);
                    setGrnResultBanner(null);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white"
                >
                  {state.purchaseOrders.map((po) => (
                    <option key={po.poId} value={po.poId}>
                      {po.poId} — {po.productNameEn} ({po.supplierName}) [{po.status}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Blind Count Mask Box */}
              {selectedPo && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3.5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <EyeOff className="w-4 h-4 text-amber-700" />
                      <span>Strict Blind Count Rule (SR-04)</span>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Supplier invoice quantity is hidden until Storekeeper submits physical box
                      count below.
                    </p>
                  </div>
                  <div className="font-mono text-sm font-bold text-amber-900 bg-white px-3 py-1.5 rounded border border-amber-300">
                    {grnResultBanner
                      ? `Expected: ${grnResultBanner.expected} Ctn`
                      : 'Expected: *** Cartons'}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="grn-good-cartons"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Counted Good Cartons (→ {BUCKET_LABELS.Available.en})
                  </label>
                  <input
                    id="grn-good-cartons"
                    type="number"
                    min={0}
                    required
                    value={countedGoodCartons}
                    onChange={(e) => setCountedGoodCartons(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono font-bold"
                  />
                </div>

                <div>
                  <label
                    htmlFor="grn-loose-pieces"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Counted Loose Pieces
                  </label>
                  <input
                    id="grn-loose-pieces"
                    type="number"
                    min={0}
                    value={countedLoosePieces}
                    onChange={(e) => setCountedLoosePieces(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>

                <div>
                  <label
                    htmlFor="grn-damaged-cartons"
                    className="block text-xs font-semibold text-rose-700 mb-1"
                  >
                    Damaged Boxes (→ {BUCKET_LABELS.Damaged.en})
                  </label>
                  <input
                    id="grn-damaged-cartons"
                    type="number"
                    min={0}
                    value={countedDamagedCartons}
                    onChange={(e) => setCountedDamagedCartons(e.target.value)}
                    className="w-full rounded-lg border border-rose-300 bg-rose-50/30 px-3 py-2 text-sm font-mono font-bold text-rose-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="grn-lot-number"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Batch / Lot Number
                  </label>
                  <input
                    id="grn-lot-number"
                    type="text"
                    required
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label
                    htmlFor="grn-expiry-date"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Expiry Date (FEFO)
                  </label>
                  <input
                    id="grn-expiry-date"
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label
                    htmlFor="grn-bin-code"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Assigned Bin Code
                  </label>
                  <input
                    id="grn-bin-code"
                    type="text"
                    required
                    value={binCode}
                    onChange={(e) => setBinCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              {grnError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2 text-xs font-semibold text-rose-800">
                  {grnError}
                </div>
              )}

              {grnResultBanner && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>
                        Blind Count Submitted & GRN Issued ({grnResultBanner.voucher?.voucherId})
                      </span>
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-800">
                      Variance: {grnResultBanner.variance >= 0 ? '+' : ''}
                      {grnResultBanner.variance} Cartons
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-mono">
                    PO Expected: {grnResultBanner.expected} Ctn | Physical Count:{' '}
                    {grnResultBanner.countedTotal} Ctn ({countedGoodCartons} Good → Available,{' '}
                    {countedDamagedCartons} Broken → Damaged).
                  </p>
                  {grnResultBanner.voucher && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenVoucher(grnResultBanner.voucher!);
                        setShowGrnModal(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#065F46] text-white text-xs font-semibold"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Open Printable {grnResultBanner.voucher.voucherId}</span>
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGrnModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Close
                </button>
                {!grnResultBanner && (
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#065F46] hover:bg-[#047857] text-xs font-semibold text-white transition-colors"
                  >
                    Submit Blind Count & Generate GRN
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
