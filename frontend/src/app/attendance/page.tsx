"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import api from "@/lib/api";
import {
  Clock, LogIn, LogOut, History, Coffee, UtensilsCrossed,
  Timer, MapPin, Building2, Home, AlertCircle, TrendingUp,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { getSocket } from "@/lib/socket";

interface BreakEntry {
  type: "lunch" | "tea" | "short";
  start: string;
  end?: string;
  duration_mins?: number;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  clock_in?: string;
  clock_out?: string;
  total_hours?: number;
  overtime_hours?: number;
  breaks: BreakEntry[];
  break_total?: number;
  is_late?: boolean;
  status?: string;
  work_type: string;
  date: string;
  created_at: string;
}

interface Summary {
  month: number;
  year: number;
  working_days: number;
  total_hours: number;
  avg_hours_per_day: number;
  late_days: number;
  overtime_days: number;
  total_overtime: number;
  present_days: number;
  half_days: number;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function breakIcon(type: string) {
  if (type === "lunch") return <UtensilsCrossed size={14} />;
  if (type === "tea") return <Coffee size={14} />;
  return <Timer size={14} />;
}

function breakLabel(type: string) {
  if (type === "lunch") return "Lunch";
  if (type === "tea") return "Tea";
  return "Short";
}

export default function AttendancePage() {
  const { token } = useAuth();
  const alert = useAlert();
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [workType, setWorkType] = useState<"office" | "wfh">("office");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const perPage = 10;

  const startTimer = useCallback((record: AttendanceRecord) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!record.clock_in || record.clock_out) return;
    const updateElapsed = () => {
      const secs = Math.floor((Date.now() - new Date(record.clock_in!).getTime()) / 1000);
      setElapsed(secs);
    };
    updateElapsed();
    timerRef.current = setInterval(updateElapsed, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const loadData = useCallback(async () => {
    try {
      const [todayRes, historyRes, summaryRes] = await Promise.all([
        api.get("/api/attendance/today").catch(() => null),
        api.get("/api/attendance", { params: { page, per_page: perPage } }),
        api.get("/api/attendance/summary").catch(() => null),
      ]);
      const today = todayRes?.data || null;
      setTodayRecord(today);
      if (today && !today.clock_out) startTimer(today);
      setHistory(historyRes.data.items);
      setTotal(historyRes.data.total);
      if (summaryRes?.data) setSummary(summaryRes.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [page, startTimer]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const reload = () => loadData();
    socket.on("clock_in", reload);
    socket.on("clock_out", reload);
    socket.on("break_start", reload);
    socket.on("break_end", reload);
    return () => {
      socket.off("clock_in", reload);
      socket.off("clock_out", reload);
      socket.off("break_start", reload);
      socket.off("break_end", reload);
    };
  }, [token, loadData]);

  const clockIn = async () => {
    try {
      const res = await api.post(`/api/attendance/clock-in?work_type=${workType}`);
      setTodayRecord(res.data);
      startTimer(res.data);
      alert.success(`Clocked in${res.data.is_late ? " (Late)" : ""} via ${workType === "wfh" ? "WFH" : "Office"}`);
      loadData();
    } catch (err: any) {
      alert.error(err.response?.data?.detail || "Failed to clock in");
    }
  };

  const clockOut = async () => {
    try {
      const res = await api.post("/api/attendance/clock-out");
      setTodayRecord(res.data);
      if (timerRef.current) clearInterval(timerRef.current);
      alert.success(`Clocked out — ${res.data.total_hours?.toFixed(1)}h${(res.data.overtime_hours || 0) > 0 ? ` (OT: ${res.data.overtime_hours?.toFixed(1)}h)` : ""}`);
      loadData();
    } catch (err: any) {
      alert.error(err.response?.data?.detail || "Failed to clock out");
    }
  };

  const startBreak = async (type: "lunch" | "tea" | "short") => {
    try {
      const res = await api.post(`/api/attendance/break-start?break_type=${type}`);
      setTodayRecord(res.data);
      alert.success(`${breakLabel(type)} break started`);
    } catch (err: any) {
      alert.error(err.response?.data?.detail || "Failed to start break");
    }
  };

  const endBreak = async () => {
    try {
      const res = await api.post("/api/attendance/break-end");
      setTodayRecord(res.data);
      alert.success("Break ended");
    } catch (err: any) {
      alert.error(err.response?.data?.detail || "Failed to end break");
    }
  };

  const activeBreak = todayRecord?.breaks?.find((b) => !b.end);
  const isOnBreak = !!activeBreak;
  const isClockedIn = !!todayRecord?.clock_in && !todayRecord?.clock_out;
  const isClockedOut = !!todayRecord?.clock_out;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
        <p className="text-muted-foreground mt-1">Real-time work hour tracking</p>
      </div>

      {/* Monthly Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
                <Sun className="text-emerald-600" size={20} />
              </div>
              <p className="text-2xl font-bold">{summary.present_days}</p>
              <p className="text-sm text-muted-foreground">Present Days</p>
              {summary.half_days > 0 && <p className="text-xs text-amber-500 mt-1">{summary.half_days} half days</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                <Clock className="text-blue-600" size={20} />
              </div>
              <p className="text-2xl font-bold">{summary.total_hours.toFixed(1)}h</p>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-xs text-muted-foreground mt-1">avg {summary.avg_hours_per_day.toFixed(1)}h/day</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                <AlertCircle className="text-amber-600" size={20} />
              </div>
              <p className="text-2xl font-bold">{summary.late_days}</p>
              <p className="text-sm text-muted-foreground">Late Arrivals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-3">
                <TrendingUp className="text-purple-600" size={20} />
              </div>
              <p className="text-2xl font-bold">{summary.total_overtime.toFixed(1)}h</p>
              <p className="text-sm text-muted-foreground">Overtime</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.overtime_days} days</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Today's Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock size={20} className="text-emerald-600" />
            Today&apos;s Attendance
            {todayRecord?.is_late && (
              <Badge variant="destructive" className="ml-2 text-xs">Late Arrival</Badge>
            )}
            {todayRecord?.status === "present" && (
              <Badge className="ml-2 text-xs bg-emerald-100 text-emerald-700">Present</Badge>
            )}
            {todayRecord?.status === "half_day" && (
              <Badge className="ml-2 text-xs bg-amber-100 text-amber-700">Half Day</Badge>
            )}
            {todayRecord?.work_type === "wfh" && (
              <Badge className="ml-2 text-xs bg-blue-100 text-blue-700">
                <Home size={12} className="mr-1" /> WFH
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayRecord ? (
            <div className="space-y-4">
              {/* Live timer */}
              {isClockedIn && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <p className="text-xs text-muted-foreground">Elapsed Time</p>
                    <p className="text-2xl font-mono font-bold text-emerald-700">{formatElapsed(elapsed)}</p>
                  </div>
                  {isOnBreak && (
                    <div className="ml-auto flex items-center gap-2 text-amber-600 text-sm font-medium">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      On {breakLabel(activeBreak!.type)} Break
                    </div>
                  )}
                </div>
              )}

              {/* Time info grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-muted rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <LogIn size={14} className="text-emerald-600" /> Clock In
                  </div>
                  <p className="text-lg font-semibold">{formatTime(todayRecord.clock_in!)}</p>
                </div>
                <div className="p-4 bg-muted rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <LogOut size={14} className="text-red-500" /> Clock Out
                  </div>
                  <p className="text-lg font-semibold">{todayRecord.clock_out ? formatTime(todayRecord.clock_out) : "—"}</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Coffee size={14} className="text-amber-600" /> Total Break
                  </div>
                  <p className="text-lg font-semibold text-amber-700">
                    {todayRecord.break_total ? `${(todayRecord.break_total * 60).toFixed(0)}m` : "0m"}
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Clock size={14} className="text-emerald-600" /> Net Hours
                  </div>
                  <p className="text-lg font-bold text-emerald-700">
                    {todayRecord.total_hours ? `${todayRecord.total_hours.toFixed(2)}h` : "In progress"}
                  </p>
                  {(todayRecord.overtime_hours || 0) > 0 && (
                    <p className="text-xs text-purple-600 mt-1">+{todayRecord.overtime_hours?.toFixed(1)}h OT</p>
                  )}
                </div>
              </div>

              {/* Break history */}
              {todayRecord.breaks.length > 0 && (
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Break History</p>
                  <div className="space-y-2">
                    {todayRecord.breaks.map((b, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1.5 w-20 text-muted-foreground">
                          {breakIcon(b.type)}
                          {breakLabel(b.type)}
                        </span>
                        <span>{formatTime(b.start)}</span>
                        <span className="text-muted-foreground">→</span>
                        <span>{b.end ? formatTime(b.end) : <span className="text-amber-600 animate-pulse">Active</span>}</span>
                        {b.duration_mins && (
                          <span className="ml-auto text-muted-foreground">{b.duration_mins.toFixed(0)} min</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {isClockedIn && (
                <div className="flex flex-wrap gap-2">
                  {isOnBreak ? (
                    <Button variant="emerald" onClick={endBreak}>
                      <Timer size={16} /> End Break
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => startBreak("lunch")}>
                        <UtensilsCrossed size={15} /> Lunch
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => startBreak("tea")}>
                        <Coffee size={15} /> Tea
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => startBreak("short")}>
                        <Timer size={15} /> Short Break
                      </Button>
                    </>
                  )}
                  {!isOnBreak && (
                    <Button variant="red" onClick={clockOut} className="ml-auto">
                      <LogOut size={16} /> Clock Out
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 space-y-4">
              <Clock size={48} className="mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">You haven&apos;t clocked in today</p>
              <div className="flex items-center justify-center gap-3">
                <div className="flex items-center gap-2 border border-border rounded-lg p-1">
                  <button
                    onClick={() => setWorkType("office")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${workType === "office" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Building2 size={14} /> Office
                  </button>
                  <button
                    onClick={() => setWorkType("wfh")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${workType === "wfh" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Home size={14} /> WFH
                  </button>
                </div>
                <Button onClick={clockIn}>
                  <LogIn size={16} /> Clock In
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History size={20} className="text-amber-600" />
            Attendance History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>In</TableHead>
                <TableHead>Out</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Break</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Net Hrs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <div>{formatDate(r.date)}</div>
                    {r.is_late && <span className="text-xs text-red-500">Late</span>}
                  </TableCell>
                  <TableCell>{r.clock_in ? formatTime(r.clock_in) : "—"}</TableCell>
                  <TableCell>{r.clock_out ? formatTime(r.clock_out) : "—"}</TableCell>
                  <TableCell>
                    {r.work_type === "wfh" ? (
                      <span className="flex items-center gap-1 text-blue-600 text-xs"><Home size={12} />WFH</span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground text-xs"><Building2 size={12} />Office</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm">
                    {r.break_total ? `${(r.break_total * 60).toFixed(0)}m` : "—"}
                    {r.breaks.length > 1 && <span className="text-xs ml-1">({r.breaks.length}x)</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.status === "present" && <Badge className="text-xs bg-emerald-100 text-emerald-700">Present</Badge>}
                    {r.status === "half_day" && <Badge className="text-xs bg-amber-100 text-amber-700">Half Day</Badge>}
                    {!r.status && <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.total_hours ? (
                      <div className="text-right">
                        <span className="text-emerald-700 font-medium">{r.total_hours.toFixed(1)}h</span>
                        {(r.overtime_hours || 0) > 0 && (
                          <div className="text-xs text-purple-500">+{r.overtime_hours?.toFixed(1)} OT</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    No attendance records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="px-4">
            <Pagination page={page} perPage={perPage} total={total} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
