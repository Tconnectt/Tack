import type { Dashboard, Equipment, EquipmentStatus, MaintenanceLog, MaintenanceType, User } from "./types";

const BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:5000").replace(/\/$/, "");
const TOKEN_KEY = "tack.accessToken";

export class ApiError extends Error {
  status: number;
  code?: string;
  issues: { path: string; message: string }[];
  constructor(status: number, message: string, code?: string, issues: { path: string; message: string }[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the session just won't persist */
  }
}

let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

// Server problems get a calm message with a next step. 403s say who may do the action.
function friendlyMessage(status: number, json: any): string {
  if (status >= 500) return "The server had a problem. Please try again in a moment. If it keeps happening, contact the person who runs this system.";
  if (status === 403 && json?.code === "FORBIDDEN") return "Only managers can do this.";
  return json?.message ?? "Something went wrong. Please try again.";
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.", "NETWORK");
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const err = new ApiError(res.status, friendlyMessage(res.status, json), json?.code, json?.issues ?? []);
    // An expired or missing token: drop the session. A wrong password also returns 401, but with a different code.
    if (res.status === 401 && err.code === "UNAUTHORIZED") unauthorizedHandler?.();
    throw err;
  }
  return json.data as T;
}

export interface EquipmentInput {
  name?: string;
  model?: string | null;
  serialNumber?: string;
  department?: string;
  status?: EquipmentStatus;
  installedOn?: string | null;
  serviceIntervalDays?: number | null;
  notes?: string | null;
}

export interface LogInput {
  performedOn: string;
  type: MaintenanceType;
  description: string;
  partsUsed?: string;
  setStatus?: EquipmentStatus;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: User; token: string }>("POST", "/auth/login", { email, password }),
  register: (name: string, email: string, password: string) =>
    request<{ user: User; token: string }>("POST", "/auth/register", { name, email, password }),
  me: () => request<User>("GET", "/auth/me"),
  dashboard: () => request<Dashboard>("GET", "/dashboard"),
  listEquipment: (f: { q?: string; status?: string; department?: string }) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
    const qs = params.toString();
    return request<Equipment[]>("GET", `/equipment${qs ? `?${qs}` : ""}`);
  },
  getEquipment: (id: string) => request<Equipment>("GET", `/equipment/${id}`),
  createEquipment: (input: EquipmentInput) => request<Equipment>("POST", "/equipment", input),
  updateEquipment: (id: string, input: EquipmentInput) => request<Equipment>("PATCH", `/equipment/${id}`, input),
  listLogs: (id: string) => request<MaintenanceLog[]>("GET", `/equipment/${id}/maintenance`),
  addLog: (id: string, input: LogInput) => request<MaintenanceLog>("POST", `/equipment/${id}/maintenance`, input),
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}
