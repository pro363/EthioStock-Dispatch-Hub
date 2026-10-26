/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Globe,
  RotateCcw,
  Settings,
  Shield,
} from 'lucide-react';
import {
  ApiIntegrationConfig,
  HubState,
  PaymentChannel,
  PrintableVoucher,
  UserRole,
  interfaceLinksEtVerificationPayload,
} from './types/domain';
import { createInitialHubState } from './utils/seedData';
import {
  approveDamagedWriteOff,
  confirmOrderAndReserveStock,
  createB2BShopOrder,
  packAndIssueSiv,
  performBlindCycleCount,
  processBlindGrn,
  processGateInSrn,
  recordDriverDelivery,
  syncDriverOfflineQueue,
} from './utils/businessRules';
import { ROLE_LABELS, UI_TEXT } from './utils/i18n';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { VoucherPrintModal } from './components/VoucherPrintModal';
import { Screen1Overview } from './components/Screen1Overview';
import { Screen2InventoryGrn } from './components/Screen2InventoryGrn';
import { Screen3ShopsOms } from './components/Screen3ShopsOms';
import { Screen4PackingSiv } from './components/Screen4PackingSiv';
import { Screen5DriverTms } from './components/Screen5DriverTms';
import { Screen6ReturnsSettlement } from './components/Screen6ReturnsSettlement';

const STORAGE_KEY = 'ethio_stock_dispatch_hub_v1';

const ALL_ROLES: UserRole[] = [
  'Sales Officer (Bole Office)',
  'Accountant / Finance',
  'Storekeeper (Kality Warehouse)',
  'Delivery Driver (Mobile Phone View)',
  'Owner / Manager',
];

export default function App() {
  const [state, setState] = useState<HubState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.shops)) {
          return parsed;
        }
      }
    } catch {
      // Fallback to seed data
    }
    return createInitialHubState();
  });

  const [activeScreen, setActiveScreen] = useState<number>(1);
  const [showApiModal, setShowApiModal] = useState<boolean>(false);
  const [activeVoucherModal, setActiveVoucherModal] = useState<PrintableVoucher | null>(
    null
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const lang = state.language;

  const handleResetDemoData = () => {
    const fresh = createInitialHubState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    setState(fresh);
    setActiveScreen(1);
  };

  const handleRoleSwitch = (role: UserRole) => {
    setState((prev) => ({ ...prev, currentRole: role }));
    if (role === 'Delivery Driver (Mobile Phone View)') {
      setActiveScreen(5);
    }
  };

  const handleToggleLanguage = () => {
    setState((prev) => ({
      ...prev,
      language: prev.language === 'en' ? 'am' : 'en',
    }));
  };

  const handleSaveApiConfig = (newConfig: ApiIntegrationConfig) => {
    setState((prev) => ({
      ...prev,
      apiConfig: newConfig,
    }));
  };

  // Screen 1 & 3: Confirm Order Deposit
  const handleConfirmOrderDeposit = (
    orderId: string,
    ref: string,
    viaLinksEt: boolean,
    payload?: interfaceLinksEtVerificationPayload
  ) => {
    setState((prev) => {
      const ord = prev.orders.find((o) => o.orderId === orderId);
      const res = confirmOrderAndReserveStock(prev, orderId, {
        referenceNumber: ref,
        paymentChannel: ord?.depositPaymentChannel || 'Telebirr',
        viaLinksEt,
        linksEtPayload: payload,
      });
      return res.nextState;
    });
  };

  // Screen 2: Blind Receiving (GRN)
  const handleReceiveBlindGrn = (params: {
    poId: string;
    countedGoodCartons: number;
    countedLoosePieces: number;
    countedDamagedCartons: number;
    lotNumber: string;
    expiryDate: string;
    binCode: string;
  }) => {
    const res = processBlindGrn(state, params);
    if (!res.error) {
      setState(res.nextState);
    }
    return {
      voucher: res.voucher,
      varianceCartons: res.varianceCartons,
      expectedCartons: res.expectedCartons,
      error: res.error,
    };
  };

  // Screen 3: Create New B2B Shop Order
  const handleCreateOrder = (params: {
    shopId: string;
    gpsLat: number;
    gpsLng: number;
    lines: { sku: string; cartons: number; loosePieces?: number }[];
    depositReferenceNumber?: string;
    depositPaymentChannel?: PaymentChannel;
    managerOverrideCredit?: boolean;
  }) => {
    const res = createB2BShopOrder(state, params);
    if (!res.error) {
      setState(res.nextState);
    }
    return { createdOrder: res.createdOrder, error: res.error };
  };

  const handleUpdateShopPolicy = (
    shopId: string,
    depositPct: number,
    creditLimitEtb: number
  ) => {
    setState((prev) => ({
      ...prev,
      shops: prev.shops.map((s) =>
        s.shopId === shopId
          ? { ...s, requiredDepositPct: depositPct, creditLimitEtb }
          : s
      ),
    }));
  };

  // Screen 4: Pack Confirmed Order & Issue SIV
  const handlePackAndIssueSiv = (params: {
    orderId: string;
    driverName: string;
    driverPhone: string;
    vanPlate: string;
  }) => {
    const res = packAndIssueSiv(state, params);
    if (!res.error) {
      setState(res.nextState);
    }
    return { voucher: res.voucher, trip: res.trip, error: res.error };
  };

  // Screen 5: Driver Delivery & Offline Sync Queue
  const handleRecordDelivery = (params: {
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
  }) => {
    const res = recordDriverDelivery(state, params);
    if (!res.error) {
      setState(res.nextState);
    }
    return { queuedOffline: res.queuedOffline, error: res.error };
  };

  const handleSyncOfflineQueue = () => {
    const res = syncDriverOfflineQueue(state);
    setState(res.nextState);
    return { syncedCount: res.syncedCount };
  };

  // Screen 6: Gate-In SRN, 5PM Settlement, Blind Cycle Count, Manager Write-Off
  const handleProcessGateInSrn = (params: {
    tripId: string;
    inspections: {
      sku: string;
      batchId: string;
      checkedOkToAvailable: number;
      checkedBrokenToDamaged: number;
    }[];
    notes?: string;
  }) => {
    const res = processGateInSrn(state, params);
    if (!res.error) {
      setState(res.nextState);
    }
    return { voucher: res.voucher, error: res.error };
  };

  const handleSettleTripByAccountant = (tripId: string) => {
    setState((prev) => ({
      ...prev,
      trips: prev.trips.map((t) =>
        t.tripId === tripId
          ? { ...t, settledByAccountant: true, settledAt: '17:05 EAT' }
          : t
      ),
    }));
  };

  const handleApproveDamagedWriteOff = (params: {
    sku: string;
    batchId: string;
    cartonsToWriteOff: number;
    reason: string;
  }) => {
    const res = approveDamagedWriteOff(state, params);
    if (!res.error) {
      setState(res.nextState);
    }
    return { voucher: res.voucher, error: res.error };
  };

  const handlePerformBlindCycleCount = (params: {
    sku: string;
    batchId: string;
    countedCartons: number;
    countedLoosePieces: number;
  }) => {
    const res = performBlindCycleCount(state, params);
    if (!res.error) {
      setState(res.nextState);
    }
    return { record: res.record, error: res.error };
  };

  const screenTabs = [
    { id: 1, label: UI_TEXT.nav.screen1[lang] },
    { id: 2, label: UI_TEXT.nav.screen2[lang] },
    { id: 3, label: UI_TEXT.nav.screen3[lang] },
    { id: 4, label: UI_TEXT.nav.screen4[lang] },
    { id: 5, label: UI_TEXT.nav.screen5[lang] },
    { id: 6, label: UI_TEXT.nav.screen6[lang] },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-900 text-white border-b border-slate-800 no-print">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveScreen(1);
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          {UI_TEXT.appName[lang]}
        </a>

        {/* Zone 2: Concise single-line text navigation links */}
        <nav
          aria-label="Primary Workspace Navigation"
          className="hidden xl:flex items-center gap-6 text-xs font-medium text-slate-300"
        >
          {screenTabs.slice(0, 5).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveScreen(tab.id)}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activeScreen === tab.id ? 'text-emerald-400 font-bold underline underline-offset-4' : ''
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowApiModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#065F46] hover:bg-[#047857] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{UI_TEXT.apiSettings[lang]}</span>
          </button>
        </div>
      </header>

      {/* Secondary Workspace Control Bar: 6-Screen Tabs + Role Switcher (NFR-03) + Bilingual Switch (SR-11) + Reset Demo */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 no-print">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* 6 Interconnected Screen Segmented Bar */}
          <div
            role="tablist"
            aria-label="6 Interconnected Logistics Screens"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {screenTabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeScreen === tab.id}
                type="button"
                onClick={() => setActiveScreen(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeScreen === tab.id
                    ? 'bg-[#065F46] text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Controls: Role Switcher + Bilingual Toggle + Reset Demo Data */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Role Switcher (NFR-03) */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1">
              <Shield className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <label
                htmlFor="global-role-switcher"
                className="text-[11px] font-bold text-slate-600 whitespace-nowrap"
              >
                Role:
              </label>
              <select
                id="global-role-switcher"
                value={state.currentRole}
                onChange={(e) => handleRoleSwitch(e.target.value as UserRole)}
                className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r][lang]}
                  </option>
                ))}
              </select>
            </div>

            {/* 1-Click Bilingual Switch (English / አማርኛ — SR-11, NFR-06) */}
            <button
              type="button"
              onClick={handleToggleLanguage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-700" />
              <span>{lang === 'en' ? 'English / አማርኛ' : 'አማርኛ / English'}</span>
            </button>

            {/* Reset Demo Data Button */}
            <button
              type="button"
              onClick={handleResetDemoData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300 text-xs font-semibold text-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{UI_TEXT.resetDemo[lang]}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeScreen === 1 && (
          <Screen1Overview
            state={state}
            onNavigateScreen={setActiveScreen}
            onConfirmOrderDeposit={handleConfirmOrderDeposit}
            onOpenVoucher={setActiveVoucherModal}
          />
        )}

        {activeScreen === 2 && (
          <Screen2InventoryGrn
            state={state}
            onReceiveBlindGrn={handleReceiveBlindGrn}
            onOpenVoucher={setActiveVoucherModal}
          />
        )}

        {activeScreen === 3 && (
          <Screen3ShopsOms
            state={state}
            onCreateOrder={handleCreateOrder}
            onConfirmOrderDeposit={handleConfirmOrderDeposit}
            onUpdateShopPolicy={handleUpdateShopPolicy}
          />
        )}

        {activeScreen === 4 && (
          <Screen4PackingSiv
            state={state}
            onPackAndIssueSiv={handlePackAndIssueSiv}
            onOpenVoucher={setActiveVoucherModal}
            onNavigateScreen={setActiveScreen}
          />
        )}

        {activeScreen === 5 && (
          <Screen5DriverTms
            state={state}
            onToggleDriverOnline={(online) =>
              setState((prev) => ({ ...prev, driverOnline: online }))
            }
            onTogglePhoneFrame={(phoneFrame) =>
              setState((prev) => ({ ...prev, driverPhoneFrameMode: phoneFrame }))
            }
            onRecordDelivery={handleRecordDelivery}
            onSyncOfflineQueue={handleSyncOfflineQueue}
            onNavigateScreen={setActiveScreen}
          />
        )}

        {activeScreen === 6 && (
          <Screen6ReturnsSettlement
            state={state}
            onProcessGateInSrn={handleProcessGateInSrn}
            onSettleTripByAccountant={handleSettleTripByAccountant}
            onApproveDamagedWriteOff={handleApproveDamagedWriteOff}
            onPerformBlindCycleCount={handlePerformBlindCycleCount}
            onOpenVoucher={setActiveVoucherModal}
            onSwitchRole={handleRoleSwitch}
          />
        )}
      </main>

      {/* Clean Quiet Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 text-xs text-slate-500 no-print">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>
            {UI_TEXT.appName[lang]} — {UI_TEXT.appSubtitle[lang]}
          </span>
          <span className="font-mono">
            5-Bucket Stock Ledger: Available · Reserved · On the Van · Pending Return · Damaged
          </span>
        </div>
      </footer>

      {/* Global Modals */}
      <ApiSettingsModal
        isOpen={showApiModal}
        config={state.apiConfig}
        onClose={() => setShowApiModal(false)}
        onSave={handleSaveApiConfig}
      />

      <VoucherPrintModal
        voucher={activeVoucherModal}
        onClose={() => setActiveVoucherModal(null)}
      />
    </div>
  );
}

