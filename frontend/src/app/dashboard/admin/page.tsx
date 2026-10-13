"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import Link from "next/link";
import {
  Users,
  FolderKanban,
  CheckSquare,
  Clock,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  UserCheck,
  CalendarOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { getSocket, disconnectSocket } from "@/lib/socket";

const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444"];

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [weekly, setWeekly] = useState<any>(null);
  const [projectHours, setProjectHours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    if (!token) return;
    const socket = getSocket(token);

    socket.on("task_created", (data: any) => {
      setStats((prev: any) => prev ? {
        ...prev,
        total_tasks: prev.total_tasks + 1,
        pending_tasks: prev.pending_tasks + (data.status === "pending" ? 1 : 0),
        in_progress_tasks: prev.in_progress_tasks + (data.status === "in_progress" ? 1 : 0),
        completed_tasks: prev.completed_tasks + (data.status === "completed" ? 1 : 0),
      } : prev);
    });

    socket.on("task_updated", () => loadStats());
    socket.on("task_deleted", () => loadStats());

    socket.on("timer_started", () => { loadProjectHours(); loadDashboardStats(); });
    socket.on("timer_stopped", () => { loadProjectHours(); loadDashboardStats(); });
    socket.on("clock_in", loadDashboardStats);
    socket.on("clock_out", loadDashboardStats);
    socket.on("break_start", loadDashboardStats);
    socket.on("break_end", loadDashboardStats);

    return () => {
      socket.off("task_created");
      socket.off("task_updated");
      socket.off("task_deleted");
      socket.off("timer_started");
      socket.off("timer_stopped");
      socket.off("clock_in");
      socket.off("clock_out");
      socket.off("break_start");
      socket.off("break_end");
    };
  }, [token]);

  const loadDashboardStats = async () => {
    try {
      const res = await api.get("/api/stats/dashboard");
      setStats(res.data);
    } catch {}
  };

  const loadProjectHours = async () => {
    try {
      const res = await api.get("/api/stats/project-hours");
      setProjectHours(res.data);
    } catch {}
  };

  const loadWeekly = async () => {
    try {
      const res = await api.get("/api/stats/weekly-tasks");
      setWeekly(res.data);
    } catch {}
  };

  const loadStats = async () => {
    try {
      const [statsRes, weeklyRes, projRes] = await Promise.all([
        api.get("/api/stats/dashboard"),
        api.get("/api/stats/weekly-tasks"),
        api.get("/api/stats/project-hours"),
      ]);
      setStats(statsRes.data);
      setWeekly(weeklyRes.data);
      setProjectHours(projRes.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 border border-border rounded-xl">
              <Skeleton className="h-10 w-10 rounded-xl mb-3" />
              <Skeleton className="h-8 w-20 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 border border-border rounded-xl">
              <Skeleton className="h-10 w-10 rounded-xl mb-3" />
              <Skeleton className="h-8 w-20 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="p-5 border border-border rounded-xl">
              <Skeleton className="h-6 w-40 mb-6" />
              <Skeleton className="h-[240px] w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Employees",
      value: stats?.total_employees || 0,
      icon: Users,
      color: "bg-blue-100 text-blue-600",
      href: "/admin/employees",
    },
    {
      label: "Active Projects",
      value: stats?.active_projects || 0,
      icon: FolderKanban,
      color: "bg-amber-100 text-amber-600",
      href: "/admin/projects",
    },
    {
      label: "Total Tasks",
      value: stats?.total_tasks || 0,
      icon: CheckSquare,
      color: "bg-emerald-100 text-emerald-600",
      href: "/admin/tasks",
    },
    {
      label: "Hours Today",
      value: `${stats?.today_hours?.toFixed(1) || "0.0"}h`,
      icon: Clock,
      color: "bg-purple-100 text-purple-600",
      href: "/admin/timings",
    },
  ];

  const statCards2 = [
    {
      label: "Overdue Tasks",
      value: stats?.overdue_tasks || 0,
      icon: AlertTriangle,
      color: "bg-red-100 text-red-600",
      href: "/admin/tasks",
    },
    {
      label: "Present Today",
      value: stats?.today_present || 0,
      icon: UserCheck,
      color: "bg-emerald-100 text-emerald-600",
      href: "/attendance",
    },
    {
      label: "Completion Rate",
      value: `${stats?.completion_rate || 0}%`,
      icon: TrendingUp,
      color: "bg-blue-100 text-blue-600",
      href: "/admin/tasks",
    },
    {
      label: "Pending Leaves",
      value: stats?.pending_leaves || 0,
      icon: CalendarOff,
      color: "bg-amber-100 text-amber-600",
      href: "/admin/leaves",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your organization</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center mb-3`}>
                    <Icon size={20} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards2.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center mb-3`}>
                    <Icon size={20} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-600" />
              Task Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Pending", value: stats?.pending_tasks || 0 },
                    { name: "In Progress", value: stats?.in_progress_tasks || 0 },
                    { name: "Completed", value: stats?.completed_tasks || 0 },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {["Pending", "In Progress", "Completed"].map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-600" />
              Tasks Created (7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weekly?.labels?.map((l: string, i: number) => ({ day: l, tasks: weekly.data[i] })) || []}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="tasks" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={20} className="text-purple-600" />
              Hours by Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projectHours.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
            ) : (
              <div className="space-y-3">
                {projectHours.map((p: any) => (
                  <div key={p.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-foreground">{p.name}</span>
                      <span className="text-muted-foreground">{p.hours}h</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min((p.hours / Math.max(...projectHours.map((x: any) => x.hours))) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href="/admin/employees"
              className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-emerald-300 hover:bg-emerald-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <Users size={20} className="text-blue-600" />
                <span className="text-sm font-medium text-foreground">Manage Employees</span>
              </div>
              <ArrowRight size={18} className="text-muted-foreground" />
            </Link>
            <Link
              href="/admin/projects"
              className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-emerald-300 hover:bg-emerald-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <FolderKanban size={20} className="text-amber-600" />
                <span className="text-sm font-medium text-foreground">Manage Projects</span>
              </div>
              <ArrowRight size={18} className="text-muted-foreground" />
            </Link>
            <Link
              href="/admin/tasks"
              className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-emerald-300 hover:bg-emerald-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <CheckSquare size={20} className="text-emerald-600" />
                <span className="text-sm font-medium text-foreground">Manage Tasks</span>
              </div>
              <ArrowRight size={18} className="text-muted-foreground" />
            </Link>
            <Link
              href="/admin/timings"
              className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-emerald-300 hover:bg-emerald-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <Clock size={20} className="text-purple-600" />
                <span className="text-sm font-medium text-foreground">View Timings</span>
              </div>
              <ArrowRight size={18} className="text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
