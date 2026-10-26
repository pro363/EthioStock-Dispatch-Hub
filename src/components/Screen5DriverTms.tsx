import React, { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Lock,
  MapPin,
  Monitor,
  Navigation,
  Phone,
  QrCode,
  RefreshCw,
  Smartphone,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import {
  HubState,
  PaymentChannel,
  interfaceLinksEtVerificationPayload,
} from '../types/domain';
import { LinksEtVerifierModal } from './LinksEtVerifierModal';

interface Screen5DriverTmsProps {
  state: HubState;
  onToggleDriverOnline: (online: boolean) => void;
  onTogglePhoneFrame: (phoneFrame: boolean) => void;
  onRecordDelivery: (params: {
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
  }) => { queuedOffline: boolean; error?: string };
  onSyncOfflineQueue: () => { syncedCount: number };
  onNavigateScreen: (screenIndex: number) => void;
}

export const Screen5DriverTms: React.FC<Screen5DriverTmsProps> = ({
  state,
  onToggleDriverOnline,
  onTogglePhoneFrame,
  onRecordDelivery,
  onSyncOfflineQueue,
  onNavigateScreen,
}) => {
  const [selectedTripId, setSelectedTripId] = useState<string>(
    state.trips.find((t) => t.stopStatus === 'Out for Delivery')?.tripId ||
      state.trips[0]?.tripId ||
      ''
  );
  const [deliveryMode, setDeliveryMode] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [rejectedCounts, setRejectedCounts] = useState<Record<string, number>>({});
  const [rejectionReason, setRejectionReason] = useState<string>(
    'Crushed outer carton corner during transit'
  );
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>('Telebirr');
  const [paymentRef, setPaymentRef] = useState<string>('TB2610268834');
  const [signatureName, setSignatureName] = useState<string>('Ato Yared Tadesse');
  const [verifiedViaLinksEt, setVerifiedViaLinksEt] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [showLinksEtModal, setShowLinksEtModal] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeTrip =
    state.trips.find((t) => t.tripId === selectedTripId) || state.trips[0];

  const unsyncedQueue = state.offlineQueue.filter((q) => !q.synced);

  const handleSelectTrip = (tripId: string) => {
    setSelectedTripId(tripId);
    setRejectedCounts({});
    setFeedbackMsg(null);
    setErrorMsg(null);
    const t = state.trips.find((x) => x.tripId === tripId);
    if (t) {
      setSignatureName(
        t.customerSignatureName ||
          state.shops.find((s) => s.shopId === t.shopId)?.contactPerson ||
          'Shop Manager'
      );
    }
  };

  // Compute live accepted amount for the selected trip
  let computedAcceptedValueEtb = 0;
  let computedRejectedCartons = 0;

  if (activeTrip) {
    for (const item of activeTrip.items) {
      const key = `${item.sku}-${item.batchId}`;
      const rej =
        deliveryMode === 'FULL'
          ? 0
          : Math.min(item.loadedCartons, Math.max(0, rejectedCounts[key] || 0));
      const acc = item.loadedCartons - rej;
      computedRejectedCartons += rej;
      computedAcceptedValueEtb += acc * item.pricePerCartonEtb;
    }
  }

  const netPayableAtDoorstepEtb = activeTrip
    ? Math.max(0, computedAcceptedValueEtb - activeTrip.depositAlreadyPaidEtb)
    : 0;

  const handleSubmitDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip) return;
    setErrorMsg(null);
    setFeedbackMsg(null);

    const itemOutcomes = activeTrip.items.map((item) => {
      const key = `${item.sku}-${item.batchId}`;
      const rej =
        deliveryMode === 'FULL'
          ? 0
          : Math.min(item.loadedCartons, Math.max(0, rejectedCounts[key] || 0));
      return {
        sku: item.sku,
        batchId: item.batchId,
        acceptedCartons: item.loadedCartons - rej,
        rejectedCartons: rej,
      };
    });

    const res = onRecordDelivery({
      tripId: activeTrip.tripId,
      itemOutcomes,
      rejectionReason: computedRejectedCartons > 0 ? rejectionReason : undefined,
      paymentMethod: paymentChannel,
      paymentReferenceNumber: paymentRef,
      paymentVerifiedViaLinksEt: verifiedViaLinksEt,
      customerSignatureName: signatureName,
    });

    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    if (res.queuedOffline) {
      setFeedbackMsg(
        `Saved to Offline Sync Queue (NFR-01)! Reference ${paymentRef} and Proof of Delivery stored locally on phone. Switch back to "Online (4G)" above to sync.`
      );
    } else if (computedRejectedCartons > 0) {
      setFeedbackMsg(
        `Partial Delivery Recorded! Accepted boxes moved to "Delivered & Sold". ${computedRejectedCartons} rejected cartons moved to "Pending Return" — Trip ${activeTrip.tripId} is now LOCKED until Gate-In SRN check!`
      );
    } else {
      setFeedbackMsg(
        `Full Delivery Completed! All loaded cartons moved from "On the Van" to "Delivered & Sold".`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Control Header */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-800">
            SCREEN 5 · DELIVERY DRIVER MOBILE APP (TMS — SR-06, SR-07, SR-08, NFR-01, NFR-05)
          </p>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            Driver Mobile Phone Screen — Doorstep PoD, Merchant QR & Offline Queue
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Driver sees only their van manifest, protected shop phone numbers, Google Maps route
            pin, and Offline Doorstep Sync Queue.
          </p>
        </div>

        {/* Toggle between Android Smartphone Frame vs Full-Width View */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onTogglePhoneFrame(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              state.driverPhoneFrameMode
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android Phone Frame</span>
          </button>
          <button
            type="button"
            onClick={() => onTogglePhoneFrame(false)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              !state.driverPhoneFrameMode
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Full-Width View</span>
          </button>
        </div>
      </div>

      {/* Main Container: Centered Android Phone Simulator or Full-Width */}
      <div
        className={
          state.driverPhoneFrameMode
            ? 'mx-auto max-w-[430px] rounded-[34px] border-[8px] border-slate-900 bg-white shadow-2xl overflow-hidden'
            : 'w-full rounded-xl border border-slate-200 bg-white overflow-hidden'
        }
      >
        {/* Top Android Status & Network Switch Bar (NFR-01, SR-07) */}
        <div className="bg-slate-900 text-white px-4 py-3 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
            <span>ethio telecom 4G · 11:35 EAT</span>
            <span>Driver: Dawit M. (Van AA-3-B48291)</span>
          </div>

          <div className="flex items-center justify-between gap-2 bg-slate-800 p-2 rounded-lg">
            <div className="flex items-center gap-2 text-xs font-bold">
              {state.driverOnline ? (
                <>
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">Online (4G Connected)</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-rose-400" />
                  <span className="text-rose-300">
                    Offline (Network Dropped at Doorstep)
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => onToggleDriverOnline(!state.driverOnline)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                state.driverOnline
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {state.driverOnline ? 'Simulate Offline Drop' : 'Reconnect 4G Online'}
            </button>
          </div>
        </div>

        {/* Offline Sync Queue Banner (NFR-01) */}
        {unsyncedQueue.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-xs text-amber-900">
              <div className="font-bold">
                Offline Sync Queue: {unsyncedQueue.length} Delivery Record(s) Stored on Phone
              </div>
              <div className="text-[11px] font-mono text-amber-800">
                Zero data loss (NFR-01). Refs:{' '}
                {unsyncedQueue.map((q) => q.paymentReferenceNumber).join(', ')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const res = onSyncOfflineQueue();
                setFeedbackMsg(
                  `Synced ${res.syncedCount} offline delivery record(s) to Kality Warehouse & Accountant 5PM Settlement!`
                );
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#065F46] hover:bg-[#047857] text-white text-xs font-bold whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Now (1-Click)</span>
            </button>
          </div>
        )}

        {/* Driver Stop Selector Tabs */}
        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Select Active Van Manifest Stop ({state.trips.length} Stops)
            </span>
            <div className="grid grid-cols-1 gap-2">
              {state.trips.map((t) => {
                const isSelected = t.tripId === activeTrip?.tripId;
                return (
                  <button
                    key={t.tripId}
                    type="button"
                    onClick={() => handleSelectTrip(t.tripId)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-emerald-50/70 border-2 border-[#065F46]'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="font-mono text-xs font-bold text-slate-900">
                        {t.tripId} · {t.shopNameEn}
                      </div>
                      <div className="text-[11px] text-slate-600 font-mono">
                        SIV: {t.sivVoucherId} · Value: ETB{' '}
                        {t.totalLoadedValueEtb.toLocaleString()}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        t.stopStatus === 'Out for Delivery'
                          ? 'text-blue-700'
                          : t.stopStatus.includes('Pending Return')
                          ? 'text-orange-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {t.stopStatus}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeTrip && (
            <div className="rounded-xl border border-slate-200 p-4 space-y-4 bg-white">
              {/* Stop Card Details */}
              <div className="space-y-2 border-b border-slate-200 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {activeTrip.shopNameEn}
                    </h2>
                    <p className="text-xs text-slate-500">{activeTrip.shopNameAm}</p>
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${activeTrip.gpsLat},${activeTrip.gpsLng}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Google Maps Pin</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {activeTrip.landmarkNote} ({activeTrip.gpsLat}, {activeTrip.gpsLng})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      Protected Contact (NFR-05): <strong>{activeTrip.shopPhoneMasked}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* If Trip is Locked due to Pending Return (SR-08) */}
              {activeTrip.stopStatus === 'Partial Delivery — Pending Return Gate Lock' && (
                <div className="rounded-lg bg-orange-50 border-2 border-orange-400 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-950">
                    <Lock className="w-4 h-4 text-orange-700 shrink-0" />
                    <span>TRIP CLOSURE LOCKED — PENDING RETURN AT GATE (SR-08)</span>
                  </div>
                  <p className="text-xs text-orange-900 leading-relaxed">
                    {activeTrip.tripLockedReason}
                  </p>
                  <div className="text-xs font-mono text-slate-700 bg-white p-2.5 rounded border border-orange-200">
                    Accepted: 28 Ctn (Delivered & Sold) · Rejected: 2 Ctn (Pending Return) ·
                    Collected: ETB {activeTrip.balanceCollectedEtb.toLocaleString()} (Ref:{' '}
                    {activeTrip.paymentReferenceNumber})
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateScreen(6)}
                    className="w-full py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors"
                  >
                    Go to Kality Gate-In Return Check (Screen 6) to Unlock Trip
                  </button>
                </div>
              )}

              {/* If Trip is Out for Delivery: Show Delivery Action Form */}
              {activeTrip.stopStatus === 'Out for Delivery' && (
                <form onSubmit={handleSubmitDelivery} className="space-y-4">
                  {/* Mode Switch: Full Delivery vs Partial Delivery / Shop Rejects Boxes */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setDeliveryMode('FULL')}
                      className={`py-2 px-3 rounded-md text-xs font-bold transition-colors ${
                        deliveryMode === 'FULL'
                          ? 'bg-white text-emerald-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      1. Full Delivery
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryMode('PARTIAL');
                        if (activeTrip.items[0]) {
                          const firstKey = `${activeTrip.items[0].sku}-${activeTrip.items[0].batchId}`;
                          setRejectedCounts({ [firstKey]: 2 });
                        }
                      }}
                      className={`py-2 px-3 rounded-md text-xs font-bold transition-colors ${
                        deliveryMode === 'PARTIAL'
                          ? 'bg-white text-orange-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      2. Partial / Reject Boxes
                    </button>
                  </div>

                  {/* Items on the Van */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-800 block">
                      Items Loaded on Van ({activeTrip.sivVoucherId}):
                    </span>
                    {activeTrip.items.map((item) => {
                      const key = `${item.sku}-${item.batchId}`;
                      const rej =
                        deliveryMode === 'FULL'
                          ? 0
                          : Math.min(
                              item.loadedCartons,
                              Math.max(0, rejectedCounts[key] || 0)
                            );
                      const acc = item.loadedCartons - rej;

                      return (
                        <div
                          key={key}
                          className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between font-bold text-slate-900">
                            <span>{item.productNameEn}</span>
                            <span className="font-mono">{item.loadedCartons} Ctn Loaded</span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            Batch {item.lotNumber} · ETB{' '}
                            {item.pricePerCartonEtb.toLocaleString()}/Ctn
                          </div>

                          {deliveryMode === 'PARTIAL' && (
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                              <div>
                                <label className="block text-[11px] font-semibold text-emerald-800">
                                  Accepted (→ Delivered & Sold)
                                </label>
                                <input
                                  type="number"
                                  readOnly
                                  value={acc}
                                  className="w-full rounded border border-slate-200 bg-slate-100 px-2 py-1 font-mono font-bold text-emerald-900"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-orange-800">
                                  Rejected (→ Pending Return)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={item.loadedCartons}
                                  value={rej}
                                  onChange={(e) =>
                                    setRejectedCounts((prev) => ({
                                      ...prev,
                                      [key]: parseInt(e.target.value, 10) || 0,
                                    }))
                                  }
                                  className="w-full rounded border border-orange-300 bg-white px-2 py-1 font-mono font-bold text-orange-900"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {deliveryMode === 'PARTIAL' && (
                    <div>
                      <label className="block text-xs font-semibold text-orange-900 mb-1">
                        Shop Rejection Reason (SR-08)
                      </label>
                      <select
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="w-full rounded-lg border border-orange-300 bg-orange-50/40 px-3 py-2 text-xs font-semibold text-slate-900"
                      >
                        <option value="Crushed outer carton corner during transit">
                          Crushed outer carton corner during transit
                        </option>
                        <option value="Shop short of cash at doorstep">
                          Shop short of cash at doorstep
                        </option>
                        <option value="Shop shelf space full">Shop shelf space full</option>
                      </select>
                    </div>
                  )}

                  {/* Payment & Merchant QR Button (SR-06) */}
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-slate-500 block">
                          Net Balance Due at Doorstep:
                        </span>
                        <span className="text-base font-bold font-mono text-emerald-800">
                          ETB {netPayableAtDoorstepEtb.toLocaleString()}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowQrModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                      >
                        <QrCode className="w-4 h-4 text-emerald-400" />
                        <span>Show Merchant QR</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Payment Channel
                        </label>
                        <select
                          value={paymentChannel}
                          onChange={(e) => setPaymentChannel(e.target.value as PaymentChannel)}
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        >
                          <option value="Telebirr">Telebirr</option>
                          <option value="CBE Birr">CBE Birr</option>
                          <option value="CBE Mobile Banking">CBE Mobile Banking</option>
                          <option value="Awash / Dashen via EthSwitch">
                            Awash / Dashen via EthSwitch
                          </option>
                          <option value="Cash on Delivery">Cash on Delivery</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Payment Reference Number
                        </label>
                        <input
                          type="text"
                          value={paymentRef}
                          onChange={(e) => setPaymentRef(e.target.value)}
                          placeholder="TB2610268834"
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    {state.driverOnline && paymentChannel !== 'Cash on Delivery' && (
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => setShowLinksEtModal(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-950 text-xs font-semibold"
                        >
                          <Zap className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Verify Reference via links.et API</span>
                        </button>
                        {verifiedViaLinksEt && (
                          <span className="text-xs font-mono font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>links.et Verified</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Receiver Digital Signature */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Shop Receiver Digital Signature Name
                    </label>
                    <input
                      type="text"
                      required
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-lg bg-[#065F46] hover:bg-[#047857] text-white text-xs font-bold transition-colors"
                  >
                    {state.driverOnline
                      ? deliveryMode === 'FULL'
                        ? 'Submit Full Delivery PoD (-> Delivered & Sold)'
                        : 'Submit Partial Delivery (-> Lock Trip for Gate-In SRN)'
                      : 'Save Delivery & Payment Reference to Offline Sync Queue'}
                  </button>
                </form>
              )}

              {errorMsg && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800">
                  {errorMsg}
                </div>
              )}

              {feedbackMsg && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-900">
                  {feedbackMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Merchant Payment QR Modal (SR-06) */}
      {showQrModal && activeTrip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="merchant-qr-title"
        >
          <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden text-center">
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#065F46] text-white">
              <span id="merchant-qr-title" className="text-sm font-bold">
                EthioStock Merchant Payment QR
              </span>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                aria-label="Close Merchant QR Modal"
                className="p-1 rounded text-emerald-100 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-xs text-slate-600">
                Scan with <strong>Telebirr SuperApp</strong>, <strong>CBE Birr</strong>, or{' '}
                <strong>EthSwitch QR</strong>
              </div>
              <div className="mx-auto w-48 h-48 rounded-xl border-2 border-slate-900 p-3 bg-white flex items-center justify-center">
                <svg viewBox="0 0 120 120" className="w-full h-full">
                  <rect width="120" height="120" fill="#FFFFFF" />
                  <rect x="8" y="8" width="32" height="32" fill="#0F172A" />
                  <rect x="14" y="14" width="20" height="20" fill="#FFFFFF" />
                  <rect x="18" y="18" width="12" height="12" fill="#065F46" />
                  <rect x="80" y="8" width="32" height="32" fill="#0F172A" />
                  <rect x="86" y="14" width="20" height="20" fill="#FFFFFF" />
                  <rect x="90" y="18" width="12" height="12" fill="#065F46" />
                  <rect x="8" y="80" width="32" height="32" fill="#0F172A" />
                  <rect x="14" y="86" width="20" height="20" fill="#FFFFFF" />
                  <rect x="18" y="90" width="12" height="12" fill="#065F46" />
                  <rect x="48" y="12" width="8" height="8" fill="#0F172A" />
                  <rect x="60" y="20" width="12" height="8" fill="#0F172A" />
                  <rect x="46" y="46" width="28" height="28" fill="#065F46" />
                  <text
                    x="60"
                    y="63"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="9"
                    fontWeight="bold"
                  >
                    ETB
                  </text>
                  <rect x="14" y="48" width="20" height="8" fill="#0F172A" />
                  <rect x="82" y="52" width="24" height="8" fill="#0F172A" />
                  <rect x="48" y="84" width="16" height="16" fill="#0F172A" />
                  <rect x="74" y="76" width="34" height="10" fill="#0F172A" />
                  <rect x="84" y="94" width="24" height="16" fill="#065F46" />
                </svg>
              </div>
              <div className="font-mono text-sm font-bold text-slate-900">
                Merchant ID: 884920 (ETHIOSTOCK PLC)
              </div>
              <div className="font-mono text-base font-bold text-emerald-800">
                Amount: ETB {netPayableAtDoorstepEtb.toLocaleString()}
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-full py-2 rounded-lg bg-slate-900 text-white text-xs font-bold"
              >
                Done Scanning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* links.et Modal on Driver Screen */}
      {showLinksEtModal && activeTrip && (
        <LinksEtVerifierModal
          isOpen={showLinksEtModal}
          onClose={() => setShowLinksEtModal(false)}
          apiConfig={state.apiConfig}
          referenceNumber={paymentRef || 'TB2610268834'}
          expectedAmountEtb={netPayableAtDoorstepEtb}
          payerHintName={activeTrip.shopNameEn}
          paymentChannel={paymentChannel}
          onVerifiedSuccess={(payload: interfaceLinksEtVerificationPayload) => {
            setPaymentRef(payload.referenceNumber);
            setVerifiedViaLinksEt(true);
          }}
        />
      )}
    </div>
  );
};
