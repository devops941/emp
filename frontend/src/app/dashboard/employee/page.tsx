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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0 });
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    loadData();
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

  const loadData = async () => {
    try {
      const [tasksRes, timerRes, attendanceRes] = await Promise.all([
        api.get("/api/tasks"),
        api.get("/api/timings/active").catch(() => null),
        api.get("/api/attendance/today").catch(() => null),
      ]);
      setTasks(tasksRes.data);
      setActiveTimer(timerRes?.data || null);
      setTodayAttendance(attendanceRes?.data || null);
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
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-emerald-50 rounded-xl">
                  <span className="text-sm font-medium text-foreground">Total Hours</span>
                  <span className="text-lg font-bold text-emerald-700">
                    {todayAttendance.total_hours?.toFixed(1) || "In progress"}h
                  </span>
                </div>
                {!todayAttendance.clock_out && (
                  <Button variant="red" className="w-full" onClick={clockOut}>
                    Clock Out
                  </Button>
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
