import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError, api } from "../lib/api";
import { describeEvent, dueText, formatDate, formatDateTime, STATUS_LABELS, todayInZone, TYPE_LABELS } from "../lib/format";
import type { EquipmentStatus, MaintenanceType } from "../lib/types";
import { useLoad } from "../lib/useLoad";
import { Card, DueBadge, ErrorNotice, Field, Spinner, StatusBadge, inputClass, primaryButton, secondaryButton } from "../components/ui";

const TIMEZONE = import.meta.env.VITE_TIMEZONE ?? "Africa/Lagos";

function RecordServiceForm({ equipmentId, onSaved }: { equipmentId: string; onSaved: () => void }) {
  const today = todayInZone(TIMEZONE);
  const [performedOn, setPerformedOn] = useState(today);
  const [type, setType] = useState<MaintenanceType>("preventive");
  const [description, setDescription] = useState("");
  const [partsUsed, setPartsUsed] = useState("");
  const [setStatus, setSetStatus] = useState<"" | EquipmentStatus>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBanner("");
    setSaved(false);
    const local: Record<string, string> = {};
    if (!performedOn) local.performedOn = "Choose the date the work was done";
    else if (performedOn > today) local.performedOn = "The date cannot be in the future";
    if (description.trim().length < 3) local.description = "Describe what was done";
    setErrors(local);
    if (Object.keys(local).length) return;

    setBusy(true);
    try {
      await api.addLog(equipmentId, {
        performedOn,
        type,
        description: description.trim(),
        ...(partsUsed.trim() ? { partsUsed: partsUsed.trim() } : {}),
        ...(setStatus ? { setStatus } : {}),
      });
      setDescription("");
      setPartsUsed("");
      setSetStatus("");
      setSaved(true);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.code === "DATE_IN_FUTURE") setErrors({ performedOn: "The date cannot be in the future" });
      else setBanner(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {banner && <ErrorNotice message={banner} />}
      {saved && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          Service recorded.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date of work" htmlFor="performedOn" error={errors.performedOn}>
          <input id="performedOn" type="date" max={today} value={performedOn} onChange={(e) => setPerformedOn(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Type of work" htmlFor="type">
          <select id="type" value={type} onChange={(e) => setType(e.target.value as MaintenanceType)} className={inputClass}>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="What was done" htmlFor="description" error={errors.description}>
        <textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Parts used (optional)" htmlFor="partsUsed">
          <input id="partsUsed" value={partsUsed} onChange={(e) => setPartsUsed(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Change status to (optional)" htmlFor="setStatus" hint="This also changes the equipment's status, for example to Under maintenance.">
          <select id="setStatus" value={setStatus} onChange={(e) => setSetStatus(e.target.value as "" | EquipmentStatus)} className={inputClass}>
            <option value="">Leave as it is</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <button type="submit" disabled={busy} className={primaryButton}>
        {busy ? "Saving…" : "Record service"}
      </button>
    </form>
  );
}

export function EquipmentDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const { data, error, loading, reload } = useLoad(
    () => Promise.all([api.getEquipment(id), api.listLogs(id), api.listHistory(id)]),
    `detail|${id}`,
  );

  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorNotice message={error ?? "Something went wrong"} onRetry={reload} />;
  const [item, logs, history] = data;

  return (
    <div className="space-y-6">
      <p>
        <Link to="/equipment" className="text-sm font-medium text-teal-800 hover:underline">
          ← All equipment
        </Link>
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{item.name}</h1>
          <p className="text-slate-700">{[item.model, item.serialNumber].filter(Boolean).join(" · ")}</p>
          <p className="text-slate-700">{item.department}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={item.status} />
          {user?.role === "manager" && (
            <Link to={`/equipment/${item.id}/edit`} className={secondaryButton}>
              Edit
            </Link>
          )}
        </div>
      </div>

      <Card title="Service schedule">
        <dl className="grid gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-slate-600">Service every</dt>
            <dd className="font-medium">{item.serviceIntervalDays ? `${item.serviceIntervalDays} days` : "Not scheduled"}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">Last serviced</dt>
            <dd className="font-medium">{formatDate(item.lastServicedOn) || "Never"}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">Next due</dt>
            <dd className="font-medium">{formatDate(item.nextDueOn) || "Not scheduled"}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">State</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <DueBadge status={item.dueStatus} />
              <span className="text-sm">{dueText(item)}</span>
            </dd>
          </div>
        </dl>
        {item.installedOn && <p className="mt-3 text-sm text-slate-600">Installed on {formatDate(item.installedOn)}</p>}
        {item.notes && <p className="mt-3 whitespace-pre-line text-slate-800">{item.notes}</p>}
      </Card>

      <Card title="Record service">
        <RecordServiceForm equipmentId={item.id} onSaved={reload} />
      </Card>

      <Card title={`Service history (${logs.length})`}>
        {logs.length === 0 ? (
          <p className="text-slate-600">No service has been recorded for this item yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((l) => (
              <li key={l.id} className="py-3">
                <p className="font-medium">
                  {TYPE_LABELS[l.type]} <span className="font-normal text-slate-700">· {formatDate(l.performedOn)}</span>
                </p>
                <p className="text-slate-800">{l.description}</p>
                {l.partsUsed && <p className="text-sm text-slate-600">Parts: {l.partsUsed}</p>}
                <p className="text-sm text-slate-600">By {l.performedByName}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Change history">
        <ul className="divide-y divide-slate-100">
          {history.map((e) => (
            <li key={e.id} className="py-3">
              <p className="text-sm text-slate-600">
                {formatDateTime(e.createdAt, TIMEZONE)}
                {e.actorName ? ` · ${e.actorName}` : ""}
              </p>
              {describeEvent(e).map((line) => (
                <p key={line} className="text-slate-800">
                  {line}
                </p>
              ))}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
