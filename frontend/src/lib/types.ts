export type Role = "manager" | "technician";
export type EquipmentStatus = "in_service" | "under_maintenance" | "out_of_service" | "retired";
export type DueStatus = "ok" | "due_soon" | "overdue" | "no_schedule";
export type MaintenanceType = "preventive" | "corrective" | "inspection" | "calibration";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Equipment {
  id: string;
  name: string;
  model: string | null;
  serialNumber: string;
  department: string;
  status: EquipmentStatus;
  installedOn: string | null;
  serviceIntervalDays: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lastServicedOn: string | null;
  nextDueOn: string | null;
  daysUntilDue: number | null;
  dueStatus: DueStatus;
}

export interface MaintenanceLog {
  id: string;
  equipmentId: string;
  performedOn: string;
  type: MaintenanceType;
  description: string;
  partsUsed: string | null;
  performedByName: string;
  createdAt: string;
}

export interface RecentLog extends MaintenanceLog {
  equipmentName: string;
}

export interface Dashboard {
  totals: { total: number; inService: number; underMaintenance: number; outOfService: number; retired: number };
  overdue: Equipment[];
  dueSoon: Equipment[];
  recentLogs: RecentLog[];
}
