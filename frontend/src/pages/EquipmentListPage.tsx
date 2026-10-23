import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { dueText, STATUS_LABELS } from "../lib/format";
import { useLoad } from "../lib/useLoad";
import { DueBadge, ErrorNotice, Spinner, StatusBadge, inputClass, primaryButton } from "../components/ui";

export function EquipmentListPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const department = params.get("department") ?? "";

  // Typing is held locally and written to the address after a short pause.
  const [qText, setQText] = useState(q);
  const [deptText, setDeptText] = useState(department);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      qText.trim() ? next.set("q", qText.trim()) : next.delete("q");
      deptText.trim() ? next.set("department", deptText.trim()) : next.delete("department");
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [qText, deptText, params, setParams]);

  function setStatus(value: string) {
    const next = new URLSearchParams(params);
    value ? next.set("status", value) : next.delete("status");
    setParams(next, { replace: true });
  }

  const { data, error, loading, reload } = useLoad(
    () => api.listEquipment({ q, status, department }),
    `list|${q}|${status}|${department}`,
  );
  const filtered = Boolean(q || status || department);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Equipment</h1>
        {user?.role === "manager" && (
          <Link to="/equipment/new" className={primaryButton}>
            Add equipment
          </Link>
        )}
      </div>

      <form role="search" onSubmit={(e) => e.preventDefault()} className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="search" className="mb-1 block text-sm font-medium">
            Search
          </label>
          <input id="search" type="search" placeholder="Name, model or serial number" value={qText} onChange={(e) => setQText(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium">
            Status
          </label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="department" className="mb-1 block text-sm font-medium">
            Department
          </label>
          <input id="department" placeholder="For example Cardiology" value={deptText} onChange={(e) => setDeptText(e.target.value)} className={inputClass} />
        </div>
      </form>

      {loading && <Spinner />}
      {error && <ErrorNotice message={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-700">
          {filtered ? "No equipment matches these filters." : "No equipment has been added yet."}
        </p>
      )}
      {data && data.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.map((e) => (
            <li key={e.id}>
              <Link to={`/equipment/${e.id}`} className="block h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-teal-700">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-slate-900">{e.name}</h2>
                  <StatusBadge status={e.status} />
                </div>
                <p className="text-sm text-slate-600">
                  {[e.model, e.serialNumber].filter(Boolean).join(" · ")}
                </p>
                <p className="text-sm text-slate-600">{e.department}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-800">
                  <DueBadge status={e.dueStatus} />
                  <span>{dueText(e)}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
