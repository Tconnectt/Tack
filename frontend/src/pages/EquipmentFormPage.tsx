import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError, api, type EquipmentInput } from "../lib/api";
import { STATUS_LABELS } from "../lib/format";
import type { Equipment, EquipmentStatus } from "../lib/types";
import { useLoad } from "../lib/useLoad";
import { Card, ErrorNotice, Field, Spinner, inputClass, primaryButton, secondaryButton } from "../components/ui";

interface Values {
  name: string;
  model: string;
  serialNumber: string;
  department: string;
  status: EquipmentStatus;
  installedOn: string;
  serviceIntervalDays: string;
  notes: string;
}

const EMPTY: Values = {
  name: "",
  model: "",
  serialNumber: "",
  department: "",
  status: "in_service",
  installedOn: "",
  serviceIntervalDays: "",
  notes: "",
};

function fromEquipment(e: Equipment): Values {
  return {
    name: e.name,
    model: e.model ?? "",
    serialNumber: e.serialNumber,
    department: e.department,
    status: e.status,
    installedOn: e.installedOn ?? "",
    serviceIntervalDays: e.serviceIntervalDays?.toString() ?? "",
    notes: e.notes ?? "",
  };
}

function validate(v: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!v.name.trim()) errors.name = "Enter the equipment name";
  if (!v.serialNumber.trim()) errors.serialNumber = "Enter the serial number";
  if (!v.department.trim()) errors.department = "Enter the department";
  if (v.serviceIntervalDays.trim()) {
    const n = Number(v.serviceIntervalDays);
    if (!Number.isInteger(n) || n < 1 || n > 3650) errors.serviceIntervalDays = "Use a whole number of days from 1 to 3650";
  }
  return errors;
}

function EquipmentForm({ existing }: { existing?: Equipment }) {
  const navigate = useNavigate();
  const editing = Boolean(existing);
  const [values, setValues] = useState<Values>(existing ? fromEquipment(existing) : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Values>(key: K) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value as Values[K] }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBanner("");
    const local = validate(values);
    setErrors(local);
    if (Object.keys(local).length) return;

    // When creating, empty optional fields are left out. When editing, they are sent as null to clear them.
    const empty = editing ? null : undefined;
    const body: EquipmentInput = {
      name: values.name.trim(),
      serialNumber: values.serialNumber.trim(),
      department: values.department.trim(),
      status: values.status,
      model: values.model.trim() || empty,
      installedOn: values.installedOn || empty,
      serviceIntervalDays: values.serviceIntervalDays.trim() ? Number(values.serviceIntervalDays) : empty,
      notes: values.notes.trim() || empty,
    };
    setBusy(true);
    try {
      const saved = existing ? await api.updateEquipment(existing.id, body) : await api.createEquipment(body);
      navigate(`/equipment/${saved.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "SERIAL_EXISTS") {
        setErrors({ serialNumber: "Another item already uses this serial number" });
      } else if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
        const fields: Record<string, string> = {};
        for (const i of err.issues) fields[i.path] ??= i.message;
        setErrors(fields);
        setBanner(err.message);
      } else {
        setBanner(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  }

  const bad = (k: string) => (errors[k] ? { "aria-invalid": true, "aria-describedby": `${k}-error` } : {});

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {banner && <ErrorNotice message={banner} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={errors.name}>
          <input id="name" value={values.name} onChange={set("name")} className={inputClass} {...bad("name")} />
        </Field>
        <Field label="Model (optional)" htmlFor="model" error={errors.model}>
          <input id="model" value={values.model} onChange={set("model")} className={inputClass} />
        </Field>
        <Field label="Serial number" htmlFor="serialNumber" error={errors.serialNumber}>
          <input id="serialNumber" value={values.serialNumber} onChange={set("serialNumber")} className={inputClass} {...bad("serialNumber")} />
        </Field>
        <Field label="Department" htmlFor="department" error={errors.department}>
          <input id="department" value={values.department} onChange={set("department")} className={inputClass} {...bad("department")} />
        </Field>
        <Field label="Status" htmlFor="status">
          <select id="status" value={values.status} onChange={set("status")} className={inputClass}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Installed on (optional)" htmlFor="installedOn" error={errors.installedOn}>
          <input id="installedOn" type="date" value={values.installedOn} onChange={set("installedOn")} className={inputClass} />
        </Field>
        <Field label="Service every (days, optional)" htmlFor="serviceIntervalDays" error={errors.serviceIntervalDays} hint="Leave empty if this item has no regular service.">
          <input id="serviceIntervalDays" inputMode="numeric" value={values.serviceIntervalDays} onChange={set("serviceIntervalDays")} className={inputClass} {...bad("serviceIntervalDays")} />
        </Field>
      </div>
      <Field label="Notes (optional)" htmlFor="notes" error={errors.notes}>
        <textarea id="notes" rows={3} value={values.notes} onChange={set("notes")} className={inputClass} />
      </Field>
      <div className="flex gap-3">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? "Saving…" : editing ? "Save changes" : "Add equipment"}
        </button>
        <Link to={existing ? `/equipment/${existing.id}` : "/equipment"} className={secondaryButton}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

function ManagersOnly() {
  return (
    <Card>
      <p className="mb-3">Only managers can add or edit equipment.</p>
      <Link to="/equipment" className={secondaryButton}>
        Back to equipment
      </Link>
    </Card>
  );
}

export function NewEquipmentPage() {
  const { user } = useAuth();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Add equipment</h1>
      {user?.role === "manager" ? (
        <Card>
          <EquipmentForm />
        </Card>
      ) : (
        <ManagersOnly />
      )}
    </div>
  );
}

export function EditEquipmentPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const { data, error, loading, reload } = useLoad(() => api.getEquipment(id), `edit|${id}`);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit equipment</h1>
      {user?.role !== "manager" ? (
        <ManagersOnly />
      ) : (
        <>
          {loading && <Spinner />}
          {error && <ErrorNotice message={error} onRetry={reload} />}
          {data && (
            <Card>
              <EquipmentForm existing={data} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
