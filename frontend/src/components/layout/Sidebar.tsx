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
          className="fixed inset-0 z-40 bg-ink-primary/40 backdrop-blur-xs md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Drawer */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40 w-64 bg-surface-pearl border-r border-ink-border flex flex-col justify-between transition-transform duration-200 ease-in-out md:static md:translate-x-0 md:z-0 shadow-2xs",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-ink-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-forest text-surface-pearl flex items-center justify-center shadow-xs">
              <Shield className="w-4 h-4 text-accent-gold" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-ink font-heading block leading-none">
                ShieldHer
              </span>
              <span className="text-[10px] font-medium tracking-wider text-ink-muted uppercase block mt-0.5">
                Private Sanctuary
              </span>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-canvas-subtle md:hidden transition-colors"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 5-Item Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted font-heading">
            Main Workspace
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
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all group",
                    isActive
                      ? "bg-brand-sage/40 text-brand-forest font-semibold shadow-2xs border-l-2 border-brand-forest"
                      : "text-ink-secondary hover:text-ink hover:bg-canvas-subtle"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        "w-4 h-4 flex-shrink-0 transition-colors",
                        isActive
                          ? "text-brand-forest"
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
              <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted font-heading flex items-center justify-between">
                <span>Authorized Review</span>
                <span className="text-[9px] bg-brand-sage/50 text-brand-forest px-1.5 py-0.2 rounded font-mono">
                  STAFF
                </span>
              </div>
              <NavLink
                to="/reviewer"
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all group",
                    isActive
                      ? "bg-brand-sage/40 text-brand-forest font-semibold shadow-2xs border-l-2 border-brand-forest"
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
                          ? "text-brand-forest"
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
        <div className="p-3.5 border-t border-ink-border/60 bg-[#FAF9F6]">
          <div className="flex items-center gap-2.5 mb-2.5 p-1.5 rounded-xl bg-surface-pearl border border-ink-border/50">
            <div className="w-8 h-8 rounded-lg bg-brand-forest text-surface-pearl font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-2xs font-heading">
              {userDisplayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-xs font-bold text-ink truncate leading-tight"
                title={user?.email || ""}
              >
                {userDisplayName}
              </div>
              <div className="text-[10px] text-ink-muted font-medium flex items-center gap-1 mt-0.5">
                <Lock className="w-2.5 h-2.5 text-brand-forest" />
                <span>Private Account</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-ink-secondary hover:text-accent-coral hover:bg-accent-coralSoft/60 border border-transparent hover:border-accent-coral/20 transition-all"
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
