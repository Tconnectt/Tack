import type { ReactNode } from "react";
import { dueLabel, STATUS_LABELS } from "../lib/format";
import type { DueStatus, EquipmentStatus } from "../lib/types";

const STATUS_STYLES: Record<EquipmentStatus, string> = {
  in_service: "bg-emerald-100 text-emerald-900",
  under_maintenance: "bg-amber-100 text-amber-900",
  out_of_service: "bg-red-100 text-red-900",
  retired: "bg-slate-200 text-slate-800",
};

const DUE_STYLES: Record<DueStatus, string> = {
  ok: "bg-emerald-100 text-emerald-900",
  due_soon: "bg-amber-100 text-amber-900",
  overdue: "bg-red-100 text-red-900",
  no_schedule: "bg-slate-200 text-slate-800",
};

const pill = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

export function StatusBadge({ status }: { status: EquipmentStatus }) {
  return <span className={`${pill} ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function DueBadge({ status }: { status: DueStatus }) {
  return <span className={`${pill} ${DUE_STYLES[status]}`}>{dueLabel(status)}</span>;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <p role="status" className="py-10 text-center text-slate-600">
      {label}…
    </p>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 font-medium underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {title && <h2 className="mb-3 text-base font-semibold text-slate-900">{title}</h2>}
      {children}
    </section>
  );
}

export const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-500 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/30";

export const primaryButton =
  "inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-700/40 disabled:opacity-60";

export const secondaryButton =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-700/30";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
