"use client";

import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  History,
  Users,
  FolderKanban,
  ListTodo,
  Timer,
  FileText,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const employeeLinks = [
  { href: "/dashboard/employee", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "My Tasks", icon: CheckSquare },
  { href: "/attendance", label: "Attendance", icon: Clock },
  { href: "/activity", label: "Activity Log", icon: History },
];

const adminLinks = [
  { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/employees", label: "Employees", icon: Users },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/tasks", label: "Tasks", icon: ListTodo },
  { href: "/admin/timings", label: "Timings", icon: Timer },
  { href: "/admin/logs", label: "Activity Logs", icon: FileText },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const links = user?.role === "admin" ? adminLinks : employeeLinks;

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
    }
    logout();
    router.push("/login");
  };

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-white rounded-xl shadow-md border border-gray-100 hover:bg-gray-50 transition-all"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X size={20} className="text-gray-700" /> : <Menu size={20} className="text-gray-700" />}
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:sticky lg:top-0 lg:self-start lg:h-screen inset-y-0 left-0 z-40 bg-white border-r border-border transition-all duration-300 ease-in-out ${
          collapsed ? "lg:w-16 w-64" : "w-64"
        } ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className={`relative border-b border-border ${collapsed ? "lg:p-3 p-6" : "p-6"}`}>
            <Link href={user?.role === "admin" ? "/dashboard/admin" : "/dashboard/employee"} className={`flex items-center ${collapsed ? "lg:justify-center" : "gap-3"}`} onClick={() => setMobileOpen(false)}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-100 shrink-0">
                <span className="text-white font-bold text-lg">ET</span>
              </div>
              <div className={`${collapsed ? "lg:hidden" : ""}`}>
                <h2 className="text-lg font-bold text-foreground">EmpTask</h2>
                <p className="text-xs text-muted-foreground">Task Management</p>
              </div>
            </Link>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-border shadow-sm items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-all"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                    collapsed ? "lg:px-3 lg:justify-center px-4 py-3" : "px-4 py-3"
                  } ${
                    isActive
                      ? "bg-gradient-to-r from-amber-50 to-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  title={collapsed ? link.label : undefined}
                >
                  <Icon size={20} className="shrink-0" />
                  <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className={`border-t border-border ${collapsed ? "lg:p-2 p-4" : "p-4"}`}>
            <div className={`flex items-center mb-2 rounded-xl bg-muted ${
              collapsed ? "lg:flex-col lg:px-1 lg:py-3 lg:gap-2 px-4 py-3 gap-3" : "px-4 py-3 gap-3"
            }`}>
              <Avatar className="w-9 h-9">
                <AvatarFallback className="text-sm">{user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className={`flex-1 min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
                <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize truncate">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className={`flex items-center rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all duration-150 ${
                collapsed ? "lg:justify-center lg:px-0 lg:py-3 px-4 py-3 gap-3 w-full" : "gap-3 px-4 py-3 w-full"
              }`}
              title={collapsed ? "Logout" : undefined}
            >
              <LogOut size={20} className="shrink-0" />
              <span className={collapsed ? "lg:hidden" : ""}>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
