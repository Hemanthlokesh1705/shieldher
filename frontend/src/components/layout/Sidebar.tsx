import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../firebase/AuthContext";
import {
  Home,
  ShieldCheck,
  FolderOpen,
  LifeBuoy,
  Settings,
  Scale,
  LogOut,
  Shield,
  X,
  Lock,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const isStaff =
    user?.role === "EXAMINER" || user?.role === "ADMIN" || user?.role === "ADVOCATE";
  const userDisplayName =
    user?.displayName || user?.email?.split("@")[0] || "Account";

  const navLinks = [
    { to: "/dashboard", label: "Home", icon: Home },
    { to: "/verification/consent", label: "Check an Image", icon: ShieldCheck },
    { to: "/cases", label: "My Requests", icon: FolderOpen },
    { to: "/help", label: "Help & Safety", icon: LifeBuoy },
    { to: "/settings", label: "Account & Privacy", icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-primary/25 backdrop-blur-xs md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Drawer */}
      <aside
        aria-label="Main navigation"
        className={cn(
          "workspace-sidebar fixed top-0 bottom-0 left-0 z-40 w-64 bg-surface-pearl border-r border-ink-border flex flex-col justify-between transition-transform duration-200 ease-in-out md:static md:translate-x-0 md:z-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-ink-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-brand-forest text-white flex items-center justify-center">
              <Shield className="w-[18px] h-[18px]" />
            </div>
            <div>
              <span className="text-lg font-semibold text-ink font-heading block leading-tight">
                ShieldHer
              </span>
              <span className="text-xs font-normal text-ink-muted block mt-1 leading-4 whitespace-nowrap">
                Evidence on your terms
              </span>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-lg text-ink-muted hover:text-ink hover:bg-canvas-subtle md:hidden transition-colors"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 5-Item Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-xs font-medium text-ink-muted font-heading">
            Workspace
          </div>
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-10 items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                    isActive
                      ? "bg-brand-forest text-white font-medium"
                      : "text-ink-secondary hover:text-ink hover:bg-canvas-subtle"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        "w-[18px] h-[18px] flex-shrink-0 transition-colors",
                        isActive
                          ? "text-white"
                          : "text-ink-muted group-hover:text-ink"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}

          {/* Role-gated Staff Portal (Strictly separated for examiners/advocates) */}
          {isStaff && (
            <div className="pt-4 mt-4 border-t border-ink-border/60">
              <div className="px-3 pb-2 text-xs font-medium text-ink-muted font-heading flex items-center justify-between">
                <span>Authorized Review</span>
                <span className="text-xs text-ink-muted">Staff</span>
              </div>
              <NavLink
                to="/reviewer"
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-10 items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                    isActive
                      ? "bg-brand-forest text-white font-medium"
                      : "text-ink-secondary hover:text-ink hover:bg-canvas-subtle"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Scale
                      className={cn(
                        "w-4 h-4 flex-shrink-0 transition-colors",
                        isActive
                          ? "text-white"
                          : "text-ink-muted group-hover:text-ink"
                      )}
                    />
                    <span className="truncate">Moderator Portal</span>
                  </>
                )}
              </NavLink>
            </div>
          )}
        </nav>

        {/* User Card & Sign Out */}
        <div className="p-3.5 border-t border-ink-border/60 bg-surface-pearl">
          <div className="flex items-center gap-2.5 mb-2.5 p-1.5 rounded-lg">
            <div className="w-8 h-8 rounded-lg bg-surface-subtle text-brand-forest font-medium text-xs flex items-center justify-center flex-shrink-0 font-heading">
              {userDisplayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-sm font-medium text-ink truncate leading-tight"
                title={user?.email || ""}
              >
                {userDisplayName}
              </div>
              <div className="text-xs text-ink-muted font-normal flex items-center gap-1 mt-1">
                <Lock className="w-3 h-3 text-ink-muted" />
                <span>Private Account</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex min-h-10 items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-status-error hover:bg-[var(--status-error-bg)] border border-transparent transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;