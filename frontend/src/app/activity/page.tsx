"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    loadLogs();
  }, [filter]);

  const loadLogs = async () => {
    try {
      const params: any = {};
      if (filter !== "all") params.entity_type = filter;
      const res = await api.get("/api/logs", { params });
      setLogs(res.data);
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
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
            onClick={() => setFilter(f)}
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
    </div>
  );
}
