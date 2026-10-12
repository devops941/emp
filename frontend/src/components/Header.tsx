"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import NotificationBell from "@/components/NotificationBell";
import { Badge } from "@/components/ui/badge";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard/admin": "Admin Dashboard",
  "/dashboard/employee": "Dashboard",
  "/tasks": "My Tasks",
  "/attendance": "Attendance",
  "/leaves": "My Leaves",
  "/activity": "Activity Log",
  "/timesheet": "Timesheet",
  "/admin/employees": "Employees",
  "/admin/projects": "Projects",
  "/admin/tasks": "Tasks",
  "/admin/timings": "Timings",
  "/admin/logs": "Activity Logs",
  "/admin/leaves": "Leave Requests",
  "/admin/attendance-settings": "Attendance Config",
  "/admin/reports": "Reports & Export",
  "/admin/departments": "Departments",
};

function getTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/tasks/")) return "Task Details";
  return "EmpTask";
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const title = getTitle(pathname);
  const isDashboard = pathname.includes("/dashboard");

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-border px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
      {/* Left — title */}
      <div className="min-w-0">
        {isDashboard ? (
          <div>
            <p className="text-xs text-muted-foreground font-medium">
              {getGreeting()}, {user?.name?.split(" ")[0]}
            </p>
            <h1 className="text-lg font-bold text-foreground leading-tight truncate">{title}</h1>
          </div>
        ) : (
          <h1 className="text-lg font-bold text-foreground truncate">{title}</h1>
        )}
      </div>

      {/* Right — actions + user */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Date — hidden on small screens */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
          <span>{formatDate()}</span>
        </div>

        {/* Notification bell */}
        <NotificationBell />

        {/* Divider */}
        <div className="w-px h-6 bg-border hidden sm:block" />

        {/* User chip */}
        <div className="flex items-center gap-2">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-amber-400 to-emerald-500 text-white">
              {user?.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:block leading-tight">
            <p className="text-sm font-semibold text-foreground leading-none">{user?.name}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{user?.role}</p>
          </div>
          <Badge
            className={`text-[10px] px-1.5 py-0.5 hidden sm:inline-flex ${
              user?.role === "admin"
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {user?.role}
          </Badge>
        </div>
      </div>
    </header>
  );
}
