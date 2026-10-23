import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError, api } from "../lib/api";
import { Card, ErrorNotice, Field, inputClass, primaryButton } from "../components/ui";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <p className="mb-1 text-center text-2xl font-bold text-teal-800">Tack</p>
      <p className="mb-6 text-center text-slate-600">Hospital equipment maintenance tracker</p>
      <Card>
        <h1 className="mb-4 text-xl font-semibold">{title}</h1>
        {children}
      </Card>
    </div>
  );
}

function fieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (err instanceof ApiError) for (const i of err.issues) out[i.path] ??= i.message;
  return out;
}

export function LoginPage() {
  const { user, sessionEnded, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (user) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await api.login(email, password);
      signIn(r.token, r.user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Sign in">
      {sessionEnded && !error && (
        <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Your session has ended. Sign in again to continue.
        </p>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <ErrorNotice message={error} />}
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Password" htmlFor="password">
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
        <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-700">
        New here?{" "}
        <Link to="/register" className="font-medium text-teal-800 underline">
          Create an account
        </Link>
      </p>
    </Shell>
  );
}

export function RegisterPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const local: Record<string, string> = {};
    if (name.trim().length < 2) local.name = "Enter your name";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) local.email = "Enter a valid email address";
    if (password.length < 8) local.password = "Use at least 8 characters";
    setFields(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      const r = await api.register(name.trim(), email.trim(), password);
      signIn(r.token, r.user);
      navigate("/", { replace: true });
    } catch (err) {
      setFields(fieldErrors(err));
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Create an account">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <ErrorNotice message={error} />}
        <Field label="Name" htmlFor="name" error={fields.name}>
          <input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Email" htmlFor="email" error={fields.email}>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Password" htmlFor="password" error={fields.password} hint="At least 8 characters. The first account on a new system becomes the manager.">
          <input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
        <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-700">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-teal-800 underline">
          Sign in
        </Link>
      </p>
    </Shell>
  );
}
