import React from 'react';
import { Printer, X, FileCheck2 } from 'lucide-react';
import { PrintableVoucher } from '../types/domain';
import { VOUCHER_TITLES } from '../utils/i18n';

interface VoucherPrintModalProps {
  voucher: PrintableVoucher | null;
  onClose: () => void;
}

export const VoucherPrintModal: React.FC<VoucherPrintModalProps> = ({ voucher, onClose }) => {
  if (!voucher) return null;

  const titleObj = VOUCHER_TITLES[voucher.voucherType];
  const totalValue = voucher.lines.reduce(
    (acc, l) => acc + l.cartons * l.unitValueEtb,
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voucher-print-title"
    >
      <div className="w-full max-w-3xl rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        {/* Top Modal Action Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white no-print">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            <span id="voucher-print-title" className="text-sm font-bold">
              Official Warehouse Voucher — {voucher.voucherId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-semibold text-white transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Voucher</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Voucher Preview"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-semibold text-emerald-800">
                ETHIOSTOCK & DISPATCH HUB PLC · ADDIS ABABA, ETHIOPIA
              </p>
              <h3 className="text-xl font-bold mt-0.5">{titleObj.en}</h3>
              <p className="text-sm font-semibold text-slate-600">{titleObj.am}</p>
            </div>
            <div className="text-right font-mono text-xs space-y-1">
              <div className="text-sm font-bold text-slate-900">
                Voucher No: {voucher.voucherId}
              </div>
              <div className="text-slate-600">Date: {voucher.createdAt}</div>
              <div className="text-slate-600">Ref Doc: {voucher.referenceDocId}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <div>
              <span className="text-slate-500 block">Counterparty / Carrier:</span>
              <span className="font-semibold text-slate-900">{voucher.counterpartyName}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Issued By Role:</span>
              <span className="font-semibold text-slate-900">{voucher.createdByRole}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-500 block">Audit & Inspection Notes:</span>
              <span className="font-medium text-slate-800">{voucher.notes}</span>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-semibold">SKU & Product</th>
                  <th className="py-2.5 px-3 font-semibold">FEFO Batch & Expiry</th>
                  <th className="py-2.5 px-3 font-semibold">Bin Location</th>
                  <th className="py-2.5 px-3 font-semibold">Bucket Transition</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Cartons</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Value (ETB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {voucher.lines.map((line, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{line.productNameEn}</div>
                      <div className="text-slate-500 font-mono text-[11px]">
                        {line.sku} · {line.productNameAm}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <div className="font-semibold text-slate-900">{line.lotNumber}</div>
                      <div className="text-slate-500 text-[11px]">Exp: {line.expiryDate}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{line.binCode}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-slate-600">{line.fromBucket}</span>
                      <span className="mx-1 text-slate-400">→</span>
                      <span className="font-semibold text-emerald-800">{line.toBucket}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                      {line.cartons} Ctn
                      {line.loosePieces ? ` + ${line.loosePieces} Pcs` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {(line.cartons * line.unitValueEtb).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 font-mono font-bold">
                  <td colSpan={4} className="py-2.5 px-3 text-right text-slate-700">
                    Total Voucher Value (ETB):
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {voucher.lines.reduce((a, b) => a + b.cartons, 0)} Ctn
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-800 tabular-nums">
                    ETB {totalValue.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Signature Footer */}
          <div className="grid grid-cols-3 gap-6 pt-6 text-xs text-slate-600">
            <div className="border-t border-slate-300 pt-2">
              <p className="font-semibold text-slate-900">Prepared By (Storekeeper)</p>
              <p className="text-[11px] text-slate-500">Kality Central Warehouse</p>
            </div>
            <div className="border-t border-slate-300 pt-2">
              <p className="font-semibold text-slate-900">Carrier / Driver Signature</p>
              <p className="text-[11px] text-slate-500">Physical Box Count Verified</p>
            </div>
            <div className="border-t border-slate-300 pt-2">
              <p className="font-semibold text-slate-900">Finance / Manager Audit</p>
              <p className="text-[11px] text-slate-500">Permanent Bin Card Logged (NFR-04)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
