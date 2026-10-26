import React from 'react';
import { StockBuckets } from '../types/domain';
import { BUCKET_LABELS, UI_TEXT } from '../utils/i18n';

interface StockBucketBarProps {
  buckets: StockBuckets;
  deliveredAndSold?: number;
  lang: 'en' | 'am';
  compact?: boolean;
}

export const StockBucketBar: React.FC<StockBucketBarProps> = ({
  buckets,
  deliveredAndSold,
  lang,
  compact = false,
}) => {
  const totalWarehouse =
    buckets.Available +
    buckets.Reserved +
    buckets['On the Van'] +
    buckets['Pending Return'] +
    buckets.Damaged;

  const pct = (val: number) =>
    totalWarehouse > 0 ? Math.max(val > 0 ? 4 : 0, (val / totalWarehouse) * 100) : 0;

  return (
    <div className="w-full space-y-1.5">
      {/* Segmented 5-Bucket Bar */}
      <div
        className="flex h-2.5 w-full overflow-hidden rounded bg-slate-100 border border-slate-200"
        title={`Available: ${buckets.Available} · Reserved: ${buckets.Reserved} · On the Van: ${buckets['On the Van']} · Pending Return: ${buckets['Pending Return']} · Damaged: ${buckets.Damaged}`}
      >
        {buckets.Available > 0 && (
          <div
            style={{ width: `${pct(buckets.Available)}%` }}
            className="bg-emerald-600 transition-all duration-200"
          />
        )}
        {buckets.Reserved > 0 && (
          <div
            style={{ width: `${pct(buckets.Reserved)}%` }}
            className="bg-amber-500 transition-all duration-200"
          />
        )}
        {buckets['On the Van'] > 0 && (
          <div
            style={{ width: `${pct(buckets['On the Van'])}%` }}
            className="bg-blue-600 transition-all duration-200"
          />
        )}
        {buckets['Pending Return'] > 0 && (
          <div
            style={{ width: `${pct(buckets['Pending Return'])}%` }}
            className="bg-orange-500 transition-all duration-200"
          />
        )}
        {buckets.Damaged > 0 && (
          <div
            style={{ width: `${pct(buckets.Damaged)}%` }}
            className="bg-rose-600 transition-all duration-200"
          />
        )}
      </div>

      {/* Unboxed tabular figures with clean typographic separators */}
      <div
        className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono tabular-nums ${
          compact ? 'text-[11px]' : 'text-xs'
        }`}
      >
        <span className="text-emerald-800 font-semibold">
          {BUCKET_LABELS.Available[lang]}: {buckets.Available}
        </span>
        <span className="text-slate-300" aria-hidden="true">
          ·
        </span>
        <span className="text-amber-700 font-medium">
          {BUCKET_LABELS.Reserved[lang]}: {buckets.Reserved}
        </span>
        <span className="text-slate-300" aria-hidden="true">
          ·
        </span>
        <span className="text-blue-700 font-medium">
          {BUCKET_LABELS['On the Van'][lang]}: {buckets['On the Van']}
        </span>
        <span className="text-slate-300" aria-hidden="true">
          ·
        </span>
        <span className="text-orange-700 font-medium">
          {BUCKET_LABELS['Pending Return'][lang]}: {buckets['Pending Return']}
        </span>
        <span className="text-slate-300" aria-hidden="true">
          ·
        </span>
        <span className="text-rose-700 font-medium">
          {BUCKET_LABELS.Damaged[lang]}: {buckets.Damaged}
        </span>

        {typeof deliveredAndSold === 'number' && (
          <>
            <span className="text-slate-300" aria-hidden="true">
              |
            </span>
            <span className="text-slate-600 font-medium">
              {UI_TEXT.deliveredAndSold[lang]}: {deliveredAndSold}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
