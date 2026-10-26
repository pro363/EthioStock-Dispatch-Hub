import React, { useState } from 'react';
import { X, CheckCircle2, Globe, KeyRound, ShieldCheck } from 'lucide-react';
import { ApiIntegrationConfig, PaymentChannel } from '../types/domain';

interface ApiSettingsModalProps {
  isOpen: boolean;
  config: ApiIntegrationConfig;
  onClose: () => void;
  onSave: (newConfig: ApiIntegrationConfig) => void;
}

const PROVIDERS: PaymentChannel[] = [
  'Telebirr',
  'CBE Birr',
  'CBE Mobile Banking',
  'Awash / Dashen via EthSwitch',
];

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  config,
  onClose,
  onSave,
}) => {
  const [endpointUrl, setEndpointUrl] = useState(config.linksEtEndpointUrl);
  const [apiKey, setApiKey] = useState(config.linksEtApiKey);
  const [provider, setProvider] = useState<PaymentChannel>(config.defaultPaymentProvider);
  const [mapsKey, setMapsKey] = useState(config.googleMapsApiKey);
  const [savedBanner, setSavedBanner] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      linksEtEndpointUrl: endpointUrl.trim() || 'https://api.links.et/v1/verify',
      linksEtApiKey: apiKey.trim(),
      defaultPaymentProvider: provider,
      googleMapsApiKey: mapsKey.trim(),
    });
    setSavedBanner(true);
    setTimeout(() => {
      setSavedBanner(false);
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-settings-title"
    >
      <div className="w-full max-w-xl rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 id="api-settings-title" className="text-base font-bold tracking-tight">
              API & Integration Setup (links.et & Google Maps)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close API Settings Modal"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Section A: links.et Payment Verification API */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-700" />
                <span>A. links.et Payment Verification API</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">SR-01 · SR-06 · SR-09</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Used by the Accountant and Delivery Driver to verify Telebirr, CBE, and EthSwitch
              transaction reference numbers in real time. If no custom endpoint is reachable in
              browser preview, the built-in links.et JSON Inspector executes automatically.
            </p>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label
                  htmlFor="links-et-endpoint"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  links.et Endpoint URL
                </label>
                <input
                  id="links-et-endpoint"
                  type="url"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  placeholder="https://api.links.et/v1/verify"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="links-et-key"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    links.et Bearer API Key
                  </label>
                  <input
                    id="links-et-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="lket_live_****************"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="links-et-provider"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Default Payment Channel
                  </label>
                  <select
                    id="links-et-provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as PaymentChannel)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Section B: Google Maps JavaScript API */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-700" />
                <span>B. Live Google Maps JavaScript API Key</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">Addis Ababa 9.0054°N, 38.7636°E</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Paste a Google Maps JS API Key to render live Google Maps tiles. When blank, the app
              automatically renders the interactive Addis Ababa Coordinate & Route Canvas with
              1-click Google Maps Directions links.
            </p>
            <div>
              <label
                htmlFor="google-maps-key"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                GOOGLE_MAPS_API_KEY
              </label>
              <input
                id="google-maps-key"
                type="text"
                value={mapsKey}
                onChange={(e) => setMapsKey(e.target.value)}
                placeholder="AIzaSyYourGoogleMapsJavaScriptKey..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {savedBanner && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>API Configuration saved to localStorage!</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#065F46] hover:bg-[#047857] text-xs font-semibold text-white transition-colors"
            >
              Save Integration Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
