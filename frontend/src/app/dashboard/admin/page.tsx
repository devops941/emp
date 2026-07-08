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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await api.get("/api/stats/dashboard");
      setStats(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-600" />
              Task Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Pending</span>
                <span className="text-sm font-medium text-foreground">{stats?.pending_tasks || 0}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-amber-400 h-2 rounded-full transition-all"
                  style={{
                    width: `${
                      stats?.total_tasks ? ((stats.pending_tasks / stats.total_tasks) * 100) : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">In Progress</span>
                <span className="text-sm font-medium text-foreground">{stats?.in_progress_tasks || 0}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${
                      stats?.total_tasks ? ((stats.in_progress_tasks / stats.total_tasks) * 100) : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Completed</span>
                <span className="text-sm font-medium text-foreground">{stats?.completed_tasks || 0}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${
                      stats?.total_tasks ? ((stats.completed_tasks / stats.total_tasks) * 100) : 0
                    }%`,
                  }}
                />
              </div>
            </div>
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
