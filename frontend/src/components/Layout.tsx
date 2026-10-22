import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  HeartHandshake,
  ClipboardList,
  BarChart3,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Sun,
  ArrowUpRight,
} from "lucide-react";
import { useAuth, isStaff } from "../hooks/auth";
import { initials, title } from "../utils/format";
import { toast } from "sonner";
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <HeartHandshake size={25} />
      </span>
      <span>
        beacon<span className="brand-sub">COMMUNITY PORTAL</span>
      </span>
    </div>
  );
}
export function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const staff = isStaff(user);
  const items = [
    { to: "/", label: "Overview", icon: LayoutDashboard },
    ...(staff ? [{ to: "/people", label: "People", icon: Users }] : []),
    {
      to: "/donations",
      label: staff ? "Donations" : "My donations",
      icon: HeartHandshake,
    },
    { to: "/surveys", label: "Surveys", icon: ClipboardList },
    ...(staff ? [{ to: "/reports", label: "Reports", icon: BarChart3 }] : []),
    ...(user?.role === "admin"
      ? [{ to: "/administration", label: "Administration", icon: ShieldCheck }]
      : []),
    { to: "/settings", label: "Settings", icon: Settings },
  ];
  const current =
    items.find((i) => i.to === location.pathname)?.label || "Portal";
  return (
    <div className="app-shell">
      {open && (
        <button
          className="nav-overlay"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-btn mobile-only"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace">
          <span className="workspace-icon">SB</span>
          <div>
            <strong>Sydney Beacon</strong>
            <small>Community service club</small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              end={to === "/"}
              key={to}
              to={to}
              onClick={() => setOpen(false)}
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="community-note">
            <Sun size={24} />
            <strong>
              A little support.
              <br />A lasting difference.
            </strong>
            <p>Connecting people with purpose.</p>
          </div>
          <button
            className="logout"
            onClick={() => logout().catch((e) => toast.error(e.message))}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-only"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <span className="desktop-only">Workspace</span>
            <span className="desktop-only">/</span>
            <strong>{current}</strong>
          </div>
          <NavLink to="/settings" className="user-menu">
            <span className="avatar">{initials(user!.name)}</span>
            <span className="user-menu-copy">
              <strong>{user!.name}</strong>
              <small>{title(user!.role)}</small>
            </span>
            <ChevronDown size={16} />
          </NavLink>
        </header>
        <main>
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} Sydney Beacon</span>
          <span>Every contribution connects us.</span>
        </footer>
      </div>
    </div>
  );
}
