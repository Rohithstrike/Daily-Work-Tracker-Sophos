import { ShieldCheck } from 'lucide-react';

/** Privacy reminder shown where activities are recorded. */
export function PrivacyNotice() {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
      <span>
        Record metadata only — for example <strong>AR, P2, 3 cases, CX replied</strong>. Never enter
        customer names, personal information, case contents, credentials, indicators or confidential
        company information.
      </span>
    </p>
  );
}
