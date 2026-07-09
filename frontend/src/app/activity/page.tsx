"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/context/AuthContext";
import { getSocket } from "@/lib/socket";

export default function ActivityLogPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  useEffect(() => {
    setLoading(true);
    loadLogs();
  }, [filter, page]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const reload = () => { setLoading(true); loadLogs(); };
    socket.on("task_created", reload);
    socket.on("task_updated", reload);
    socket.on("task_deleted", reload);
    socket.on("timer_started", reload);
    socket.on("timer_stopped", reload);
    socket.on("clock_in", reload);
    socket.on("clock_out", reload);
    return () => {
      socket.off("task_created", reload);
      socket.off("task_updated", reload);
      socket.off("task_deleted", reload);
      socket.off("timer_started", reload);
      socket.off("timer_stopped", reload);
      socket.off("clock_in", reload);
      socket.off("clock_out", reload);
    };
  }, [token, filter, page]);

  const loadLogs = async () => {
    try {
      const params: any = { page, per_page: perPage };
      if (filter !== "all") params.entity_type = filter;
      const res = await api.get("/api/logs", { params });
      setLogs(res.data.items);
      setTotal(res.data.total);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes("timer")) return "⏱️";
    if (a.includes("clocked")) return "🕐";
    if (a.includes("logged")) return "🔑";
    if (a.includes("created")) return "✅";
    if (a.includes("updated")) return "✏️";
    if (a.includes("deleted")) return "🗑️";
    return "📋";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 border border-border rounded-xl">
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
        <p className="text-muted-foreground mt-1">Your work history</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "timing", "attendance", "task", "user", "project"].map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => { setFilter(f); setPage(1); }}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {logs.map((log: any) => (
          <Card key={log.id} className="hover:border-emerald-100 transition-all">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{getActionIcon(log.action)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{log.action}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(log.created_at).toLocaleString("en-IN")}
                    </span>
                  </div>
                  {log.details && (
                    <p className="text-sm text-muted-foreground mt-0.5">{log.details}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {log.user_name || "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full capitalize">
                      {log.entity_type}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {logs.length === 0 && (
          <div className="text-center py-12">
            <History size={48} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No activity logs found</p>
          </div>
        )}
      </div>

      <Pagination page={page} perPage={perPage} total={total} onPageChange={setPage} />
    </div>
  );
}
