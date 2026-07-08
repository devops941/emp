"use client";

import { useState, useEffect, useMemo } from "react";
import api from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { Play, Square, ArrowLeft, Calendar, Clock, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function TaskDetailPage() {
  const { id } = useParams();
  const router = useRouter();
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
    try {
      await api.put(`/api/tasks/${id}/status?status=${status}`);
      toast.success(`Status updated to ${status}`);
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
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
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>{task.title}</CardTitle>
                {task.project_name && (
                  <p className="text-sm text-muted-foreground mt-1">Project: {task.project_name}</p>
                )}
              </div>
              <select
                value={task.status}
                onChange={(e) => updateStatus(e.target.value)}
                className="text-sm border border-input rounded-lg px-3 py-2 outline-none focus:border-ring bg-background"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
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
              {activeTimer && activeTimer.task_id === task.id ? (
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
