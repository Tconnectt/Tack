import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { dueText, formatDate, TYPE_LABELS } from "../lib/format";
import type { Equipment } from "../lib/types";
import { useLoad } from "../lib/useLoad";
import { Card, DueBadge, ErrorNotice, Spinner } from "../components/ui";

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm">{label}</p>
    </div>
  );
}

function DueList({ items, empty }: { items: Equipment[]; empty: string }) {
  if (items.length === 0) return <p className="text-slate-600">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((e) => (
        <li key={e.id}>
          <Link to={`/equipment/${e.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 hover:bg-slate-50">
            <span>
              <span className="font-medium text-slate-900">{e.name}</span>
              <span className="block text-sm text-slate-600">
                {e.department} · {e.serialNumber}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-sm text-slate-700">{dueText(e)}</span>
              <DueBadge status={e.dueStatus} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  const { data, error, loading, reload } = useLoad(() => api.dashboard(), "dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      {loading && <Spinner />}
      {error && <ErrorNotice message={error} onRetry={reload} />}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total equipment" value={data.totals.total} tone="border-slate-200 bg-white" />
            <Stat label="In service" value={data.totals.inService} tone="border-emerald-200 bg-emerald-50 text-emerald-950" />
            <Stat label="Under maintenance" value={data.totals.underMaintenance} tone="border-amber-200 bg-amber-50 text-amber-950" />
            <Stat label="Out of service" value={data.totals.outOfService} tone="border-red-200 bg-red-50 text-red-950" />
          </div>
          <Card title={`Overdue (${data.overdue.length})`}>
            <DueList items={data.overdue} empty="Nothing is overdue." />
          </Card>
          <Card title={`Due soon (${data.dueSoon.length})`}>
            <DueList items={data.dueSoon} empty="Nothing is due in the next 14 days." />
          </Card>
          <Card title="Recent work">
            {data.recentLogs.length === 0 ? (
              <p className="text-slate-600">No service has been recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recentLogs.map((l) => (
                  <li key={l.id} className="py-2.5">
                    <Link to={`/equipment/${l.equipmentId}`} className="font-medium text-teal-800 hover:underline">
                      {l.equipmentName}
                    </Link>
                    <span className="text-slate-700">
                      {" "}
                      · {TYPE_LABELS[l.type]} · {formatDate(l.performedOn)} · {l.performedByName}
                    </span>
                    <p className="text-sm text-slate-600">{l.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
