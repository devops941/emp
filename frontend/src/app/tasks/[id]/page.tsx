"use client";

import { useState, useEffect, useMemo } from "react";
import api from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { Play, Square, ArrowLeft, Calendar, Clock, AlertTriangle, MessageSquare } from "lucide-react";
import Link from "next/link";
import DeadlineBadge from "@/components/DeadlineBadge";
import CommentSection from "@/components/CommentSection";
import FileUpload from "@/components/FileUpload";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { getSocket } from "@/lib/socket";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function TaskDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const [task, setTask] = useState<any>(null);
  const [timings, setTimings] = useState<any[]>([]);
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    loadData();
    checkActiveTimer();
  }, [id]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const reload = () => { loadData(); checkActiveTimer(); };
    socket.on("task_updated", reload);
    socket.on("timer_started", reload);
    socket.on("timer_stopped", reload);
    return () => {
      socket.off("task_updated", reload);
      socket.off("timer_started", reload);
      socket.off("timer_stopped", reload);
    };
  }, [token, id]);

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

  const loadData = async () => {
    try {
      const [taskRes, timingsRes] = await Promise.all([
        api.get(`/api/tasks/${id}`),
        api.get("/api/timings"),
      ]);
      setTask(taskRes.data);
      const taskTimings = timingsRes.data.filter((t: any) => t.task_id === id);
      setTimings(taskTimings);
    } catch {
      toast.error("Task not found");
      router.push("/tasks");
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

  const startTimer = async () => {
    try {
      const res = await api.post("/api/timings/start", { task_id: id, action: "start" });
      setActiveTimer(res.data);
      toast.success("Timer started");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to start timer");
    }
  };

  const stopTimer = async () => {
    try {
      const res = await api.post("/api/timings/stop", { task_id: id, action: "stop" });
      setActiveTimer(null);
      setElapsed(0);
      toast.success(`Logged ${res.data.duration_minutes?.toFixed(1)} min`);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to stop timer");
    }
  };

  const updateStatus = async (status: string) => {
    const labels: Record<string, string> = { pending: "Pending", in_progress: "In Progress", completed: "Completed" };
    try {
      const res = await api.put(`/api/tasks/${id}/status?status=${status}`);
      toast.success(`${labels[status]} ✓`, { icon: "🎯" });
      loadData();
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

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-24" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="p-5 border border-border rounded-xl">
              <Skeleton className="h-7 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/3 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-4/5 mb-4" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="p-5 border border-border rounded-xl">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-[200px] w-full rounded-lg" />
            </div>
          </div>
          <div className="space-y-6">
            <div className="p-5 border border-border rounded-xl">
              <Skeleton className="h-6 w-16 mb-4" />
              <Skeleton className="h-[120px] w-full rounded-lg" />
            </div>
            <div className="p-5 border border-border rounded-xl">
              <Skeleton className="h-6 w-20 mb-4" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full mb-3" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!task) return null;

  const completedTimings = useMemo(() => timings.filter((t) => !t.is_running), [timings]);
  const totalTime = useMemo(() => completedTimings.reduce((sum, t) => sum + (t.duration_minutes || 0), 0), [completedTimings]);

  return (
    <div className="space-y-6">
      <Link href="/tasks" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Back to Tasks
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare size={20} className="text-emerald-600" />
                Comments & Files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FileUpload />
              <CommentSection taskId={id as string} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>{task.title}</CardTitle>
                {task.project_name && (
                  <p className="text-sm text-muted-foreground mt-1">Project: {task.project_name}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {task.status === "pending" && (
                  <>
                    <span className="flex items-center gap-1.5 text-sm text-amber-600">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Pending
                    </span>
                    <button
                      onClick={() => updateStatus("in_progress")}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-50 transition-colors"
                    >
                      Start Working →
                    </button>
                  </>
                )}
                {task.status === "in_progress" && (
                  <>
                    <span className="flex items-center gap-1.5 text-sm text-blue-600">
                      <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                      In Progress
                    </span>
                    <button
                      onClick={() => updateStatus("completed")}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-50 transition-colors"
                    >
                      Mark Complete →
                    </button>
                  </>
                )}
                {task.status === "completed" && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Completed
                  </span>
                )}
                {task.status === "cancelled" && (
                  <span className="flex items-center gap-1.5 text-sm text-red-500">
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                    Cancelled
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{task.description || "No description provided."}</p>
              <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar size={16} />
                  <span>Created: {new Date(task.created_at).toLocaleDateString("en-IN")}</span>
                </div>
                {task.deadline && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertTriangle size={16} />
                    <span>Deadline: {new Date(task.deadline).toLocaleDateString("en-IN")}</span>
                    <DeadlineBadge deadline={task.deadline} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock size={20} className="text-emerald-600" />
                Time Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedTimings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No time logged yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    completedTimings.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell>{new Date(t.start_time).toLocaleString("en-IN")}</TableCell>
                        <TableCell>{t.end_time ? new Date(t.end_time).toLocaleString("en-IN") : "-"}</TableCell>
                        <TableCell className="text-right font-medium">{t.duration_minutes?.toFixed(1)} min</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {completedTimings.length > 0 && (
                  <tfoot>
                    <TableRow>
                      <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">{totalTime.toFixed(1)} min</TableCell>
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Timer</CardTitle>
            </CardHeader>
            <CardContent>
              {["completed", "cancelled"].includes(task.status) ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Task is {task.status}</p>
                </div>
              ) : activeTimer && activeTimer.task_id === task.id ? (
                <div className="text-center">
                  <p className="text-4xl font-mono font-bold text-emerald-700 mb-4">{formatTime(elapsed)}</p>
                  <Button variant="red" className="w-full" onClick={stopTimer}>
                    <Square size={18} /> Stop Timer
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Clock size={48} className="mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No active timer</p>
                  <Button className="w-full" onClick={startTimer} disabled={!!activeTimer}>
                    <Play size={18} /> Start Timer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Priority</span>
                <Badge variant={task.priority as any}>{task.priority}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Assigned To</span>
                <span className="font-medium text-foreground">{task.assigned_name || "Unassigned"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-foreground capitalize">{task.status}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimate</span>
                <span className="font-medium text-foreground">{task.estimated_hours ? `${task.estimated_hours}h` : "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Actual Time</span>
                <span className={`font-medium ${task.actual_hours && task.estimated_hours && task.actual_hours > task.estimated_hours ? "text-red-600" : "text-foreground"}`}>
                  {(() => {
                    const total = totalTime;
                    const hours = total / 60;
                    return `${hours.toFixed(1)}h`;
                  })()}
                  {task.estimated_hours && (totalTime / 60) > task.estimated_hours && " (over)"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
