"use client";

import { useState, useEffect, useMemo } from "react";
import api from "@/lib/api";
import Link from "next/link";
import { Play, Square, Search, Timer } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [timePerTask, setTimePerTask] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    loadTasks();
    checkActiveTimer();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTimer) {
      interval = setInterval(() => {
        const start = new Date(activeTimer.start_time + "+05:30").getTime();
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  const loadTasks = async () => {
    try {
      const [tasksRes, timingsRes] = await Promise.all([
        api.get("/api/tasks"),
        api.get("/api/timings"),
      ]);
      setTasks(tasksRes.data);
      const acc: Record<string, number> = {};
      for (const t of timingsRes.data) {
        if (!t.is_running && t.duration_minutes) {
          acc[t.task_id] = (acc[t.task_id] || 0) + t.duration_minutes;
        }
      }
      setTimePerTask(acc);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const checkActiveTimer = async () => {
    try {
      const res = await api.get("/api/timings/active");
      setActiveTimer(res.data);
    } catch {
      setActiveTimer(null);
    }
  };

  const startTimer = async (taskId: string) => {
    try {
      const res = await api.post("/api/timings/start", { task_id: taskId, action: "start" });
      setActiveTimer(res.data);
      toast.success("Timer started");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to start timer");
    }
  };

  const stopTimer = async (taskId: string) => {
    try {
      const res = await api.post("/api/timings/stop", { task_id: taskId, action: "stop" });
      setActiveTimer(null);
      setElapsed(0);
      toast.success(`Logged ${res.data.duration_minutes?.toFixed(1)} min`);
      loadTasks();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to stop timer");
    }
  };

  const updateStatus = async (taskId: string, status: string) => {
    try {
      await api.put(`/api/tasks/${taskId}/status?status=${status}`);
      toast.success(`Task marked as ${status}`);
      loadTasks();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update status");
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const totalTimeForTask = (taskId: string) => {
    let mins = timePerTask[taskId] || 0;
    if (activeTimer && activeTimer.task_id === taskId) {
      mins += elapsed / 60;
    }
    return mins;
  };

  const filteredTasks = useMemo(() => {
    const q = search.toLowerCase();
    return tasks.filter((task) => {
      return task.title.toLowerCase().includes(q) && (filter === "all" || task.status === filter);
    });
  }, [tasks, search, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage and track your tasks</p>
        </div>
      </div>

      {activeTimer && (
        <div className="bg-gradient-to-r from-amber-50 to-emerald-50 rounded-2xl p-4 border border-emerald-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
            <div>
              <p className="text-sm text-muted-foreground">Active Timer</p>
              <p className="font-semibold text-foreground">{activeTimer.task_title}</p>
            </div>
            <span className="text-xl font-mono font-bold text-emerald-700 tabular-nums">{formatTime(elapsed)}</span>
          </div>
          <Button variant="red" size="sm" onClick={() => stopTimer(activeTimer.task_id)}>
            <Square size={16} /> Stop
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "in_progress", "completed"].map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f.replace("_", " ").charAt(0).toUpperCase() + f.slice(1).replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Time Spent</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredTasks.map((task: any) => (
            <TableRow key={task.id}>
              <TableCell>
                <Link href={`/tasks/${task.id}`} className="text-sm font-medium text-foreground hover:text-emerald-600">
                  {task.title}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{task.project_name || "-"}</TableCell>
              <TableCell>
                <Badge variant={task.priority as any}>{task.priority}</Badge>
              </TableCell>
              <TableCell>
                <select
                  value={task.status}
                  onChange={(e) => updateStatus(task.id, e.target.value)}
                  className="text-xs border border-input rounded-lg px-2 py-1.5 outline-none focus:border-ring bg-background cursor-pointer"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
                  <Timer size={14} className="text-muted-foreground" />
                  {(() => {
                    const total = totalTimeForTask(task.id);
                    return `${Math.floor(total / 60)}h ${Math.round(total % 60)}m`;
                  })()}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {task.deadline ? new Date(task.deadline).toLocaleDateString("en-IN") : "-"}
              </TableCell>
              <TableCell className="text-right">
                {activeTimer && activeTimer.task_id === task.id ? (
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-mono font-bold text-emerald-700 text-sm tabular-nums">
                      {formatTime(elapsed)}
                    </span>
                    <Button variant="red" size="sm" onClick={() => stopTimer(task.id)}>
                      <Square size={14} /> Stop
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="emerald"
                    size="sm"
                    onClick={() => startTimer(task.id)}
                    disabled={!!activeTimer}
                  >
                    <Play size={14} /> Start
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {filteredTasks.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                No tasks found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
