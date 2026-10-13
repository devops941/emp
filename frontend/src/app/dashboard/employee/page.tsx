"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import Link from "next/link";
import {
  CheckSquare,
  Clock,
  Timer,
  Play,
  Square,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { getSocket, disconnectSocket } from "@/lib/socket";

export default function EmployeeDashboard() {
  const { user, token } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0 });
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    loadData();
    if (!token) return;
    const socket = getSocket(token);

    socket.on("task_created", (data: any) => {
      if (data.assigned_to === user?.id) {
        setTasks((prev: any[]) => [data, ...prev]);
        setStats((prev) => ({ ...prev, total: prev.total + 1 }));
      }
    });

    socket.on("timer_started", (data: any) => {
      if (data.user_id === user?.id) { checkActiveTimer(); loadTasksOnly(); }
    });
    socket.on("timer_stopped", (data: any) => {
      if (data.user_id === user?.id) { checkActiveTimer(); loadTasksOnly(); }
    });
    socket.on("task_updated", () => loadTasksOnly());
    socket.on("clock_in", loadTodayAttendance);
    socket.on("clock_out", loadTodayAttendance);
    socket.on("break_start", loadTodayAttendance);
    socket.on("break_end", loadTodayAttendance);

    return () => {
      socket.off("task_created");
      socket.off("task_updated");
      socket.off("timer_started");
      socket.off("timer_stopped");
      socket.off("clock_in");
      socket.off("clock_out");
      socket.off("break_start");
      socket.off("break_end");
    };
  }, [token, user?.id]);

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

  const checkActiveTimer = async () => {
    try {
      const res = await api.get("/api/timings/active");
      setActiveTimer(res.data);
      if (res.data) {
        const start = new Date(res.data.start_time + "+05:30").getTime();
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }
    } catch { setActiveTimer(null); }
  };

  const loadTasksOnly = async () => {
    try {
      const [tasksRes, weeklyRes] = await Promise.all([
        api.get("/api/tasks/", { params: { per_page: 100 } }),
        api.get("/api/stats/my-weekly"),
      ]);
      setTasks(tasksRes.data.items);
      setWeeklyData(weeklyRes.data);
      const total = tasksRes.data.length;
      const completed = tasksRes.data.filter((t: any) => t.status === "completed").length;
      const inProgress = tasksRes.data.filter((t: any) => t.status === "in_progress").length;
      setStats({ total, completed, inProgress });
    } catch {}
  };

  const loadTodayAttendance = async () => {
    try {
      const res = await api.get("/api/attendance/today");
      setTodayAttendance(res.data);
    } catch {}
  };

  const loadData = async () => {
    try {
      const [tasksRes, timerRes, attendanceRes, weeklyRes] = await Promise.all([
        api.get("/api/tasks/", { params: { per_page: 100 } }),
        api.get("/api/timings/active").catch(() => null),
        api.get("/api/attendance/today").catch(() => null),
        api.get("/api/stats/my-weekly"),
      ]);
      setTasks(tasksRes.data.items);
      setActiveTimer(timerRes?.data || null);
      setTodayAttendance(attendanceRes?.data || null);
      setWeeklyData(weeklyRes.data);
      const total = tasksRes.data.length;
      const completed = tasksRes.data.filter((t: any) => t.status === "completed").length;
      const inProgress = tasksRes.data.filter((t: any) => t.status === "in_progress").length;
      setStats({ total, completed, inProgress });
    } catch {
    } finally {
      setLoading(false);
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
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to stop timer");
    }
  };

  const clockIn = async () => {
    try {
      const res = await api.post("/api/attendance/clock-in");
      setTodayAttendance(res.data);
      toast.success("Clocked in!");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to clock in");
    }
  };

  const clockOut = async () => {
    try {
      const res = await api.post("/api/attendance/clock-out");
      setTodayAttendance(res.data);
      toast.success("Clocked out!");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to clock out");
    }
  };

  const breakStart = async () => {
    try {
      const res = await api.post("/api/attendance/break-start");
      setTodayAttendance(res.data);
      toast.success("Break started");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to start break");
    }
  };

  const breakEnd = async () => {
    try {
      const res = await api.post("/api/attendance/break-end");
      setTodayAttendance(res.data);
      toast.success(`Break ended (${res.data.break_total}h total)`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to end break");
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
        <div className="space-y-1">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 border border-border rounded-xl">
              <Skeleton className="h-10 w-10 rounded-xl mb-3" />
              <Skeleton className="h-8 w-12 mb-1" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="p-5 border border-border rounded-xl">
              <Skeleton className="h-6 w-36 mb-6" />
              <Skeleton className="h-[200px] w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="border border-border rounded-xl p-5">
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const recentTasks = tasks.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome, {user?.name}</h1>
        <p className="text-muted-foreground mt-1">Here&apos;s your overview for today</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
              <CheckSquare className="text-amber-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
              <CheckSquare className="text-emerald-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
              <Timer className="text-blue-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.inProgress}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-3">
              <Clock className="text-purple-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {todayAttendance?.total_hours?.toFixed(1) || "0.0"}h
            </p>
            <p className="text-sm text-muted-foreground">Today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer size={20} className="text-emerald-600" />
              Time Tracker
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeTimer ? (
              <div className="bg-gradient-to-r from-amber-50 to-emerald-50 rounded-xl p-4 border border-emerald-100">
                <p className="text-sm text-muted-foreground mb-1">Working on:</p>
                <p className="font-semibold text-foreground mb-2">{activeTimer.task_title}</p>
                <p className="text-3xl font-mono font-bold text-emerald-700 mb-3">{formatTime(elapsed)}</p>
                <Button variant="red" size="sm" onClick={() => stopTimer(activeTimer.task_id)}>
                  <Square size={16} /> Stop Timer
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <Timer size={40} className="mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No active timer</p>
                {pendingTasks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground mb-2">Start working on:</p>
                    {pendingTasks.slice(0, 3).map((task: any) => (
                      <button
                        key={task.id}
                        onClick={() => startTimer(task.id)}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left"
                      >
                        <span className="text-sm font-medium text-foreground truncate">{task.title}</span>
                        <Play size={16} className="text-emerald-600 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={20} className="text-amber-600" />
              Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAttendance ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                  <span className="text-sm text-muted-foreground">Clock In</span>
                  <span className="text-sm font-medium text-foreground">
                    {new Date(todayAttendance.clock_in).toLocaleTimeString("en-IN")}
                  </span>
                </div>
                {todayAttendance.clock_out && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                    <span className="text-sm text-muted-foreground">Clock Out</span>
                    <span className="text-sm font-medium text-foreground">
                      {new Date(todayAttendance.clock_out).toLocaleTimeString("en-IN")}
                    </span>
                  </div>
                )}
                {(todayAttendance.break_total || todayAttendance.break_start) && (
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                    <span className="text-sm text-muted-foreground">Break</span>
                    <span className="text-sm font-medium text-amber-700">
                      {todayAttendance.break_start && !todayAttendance.break_end ? "On break" : `${todayAttendance.break_total?.toFixed(1) || "0.0"}h`}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-emerald-50 rounded-xl">
                  <span className="text-sm font-medium text-foreground">Net Hours</span>
                  <span className="text-lg font-bold text-emerald-700">
                    {todayAttendance.total_hours?.toFixed(1) || "In progress"}h
                  </span>
                </div>
                {!todayAttendance.clock_out && (
                  <div className="flex flex-col gap-2">
                    {todayAttendance.break_start && !todayAttendance.break_end ? (
                      <Button variant="emerald" className="w-full" onClick={breakEnd}>
                        End Break
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full" onClick={breakStart}>
                        Take Break
                      </Button>
                    )}
                    <Button variant="red" className="w-full" onClick={clockOut}>
                      Clock Out
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <Clock size={40} className="mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">Not clocked in today</p>
                <Button onClick={clockIn}>Clock In</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {weeklyData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare size={20} className="text-blue-600" />
              Tasks Completed (7 Days) &mdash; {weeklyData.total_hours}h total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData.labels?.map((l: string, i: number) => ({ day: l, tasks: weeklyData.data[i] })) || []}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="tasks" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckSquare size={20} className="text-emerald-600" />
            Recent Tasks
          </CardTitle>
          <Link
            href="/tasks"
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
          >
            View All <ArrowRight size={16} />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTasks.map((task: any) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      {task.project_name && (
                        <p className="text-xs text-muted-foreground">{task.project_name}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={task.priority as any}>{task.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={task.status as any}>{task.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {recentTasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No tasks assigned yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
