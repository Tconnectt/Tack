import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Spinner, secondaryButton } from "./ui";

const navLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-slate-200"}`;

export function Layout() {
  const { user, checking, signOut } = useAuth();
  const location = useLocation();

  if (checking) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="mr-2 text-lg font-bold text-teal-800">
            Tack
          </Link>
          <nav aria-label="Main" className="flex gap-1">
            <NavLink to="/" end className={navLink}>
              Dashboard
            </NavLink>
            <NavLink to="/equipment" className={navLink}>
              Equipment
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-slate-700">
              {user.name} <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs capitalize">{user.role}</span>
            </span>
            <button type="button" onClick={signOut} className={`${secondaryButton} !px-3 !py-1.5 text-sm`}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
