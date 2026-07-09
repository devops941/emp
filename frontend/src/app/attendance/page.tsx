"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Clock, LogIn, LogOut, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { getSocket } from "@/lib/socket";

export default function AttendancePage() {
  const { token } = useAuth();
  const alert = useAlert();
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 10;

  useEffect(() => {
    loadData();
  }, [page]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const reload = () => loadData();
    socket.on("clock_in", reload);
    socket.on("clock_out", reload);
    return () => {
      socket.off("clock_in", reload);
      socket.off("clock_out", reload);
    };
  }, [token, page]);

  const loadData = async () => {
    try {
      const [todayRes, historyRes] = await Promise.all([
        api.get("/api/attendance/today").catch(() => null),
        api.get("/api/attendance", { params: { page, per_page: perPage } }),
      ]);
      setTodayRecord(todayRes?.data || null);
      setHistory(historyRes.data.items);
      setTotal(historyRes.data.total);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const clockIn = async () => {
    try {
      const res = await api.post("/api/attendance/clock-in");
      setTodayRecord(res.data);
      alert.success("Clocked in successfully!");
    } catch (err: any) {
      alert.error(err.response?.data?.detail || "Failed to clock in");
    }
  };

  const clockOut = async () => {
    try {
      const res = await api.post("/api/attendance/clock-out");
      setTodayRecord(res.data);
      alert.success("Clocked out successfully!");
      loadData();
    } catch (err: any) {
      alert.error(err.response?.data?.detail || "Failed to clock out");
    }
  };

  const breakStart = async () => {
    try {
      const res = await api.post("/api/attendance/break-start");
      setTodayRecord(res.data);
      alert.success("Break started");
    } catch (err: any) {
      alert.error(err.response?.data?.detail || "Failed to start break");
    }
  };

  const breakEnd = async () => {
    try {
      const res = await api.post("/api/attendance/break-end");
      setTodayRecord(res.data);
      alert.success("Break ended");
      loadData();
    } catch (err: any) {
      alert.error(err.response?.data?.detail || "Failed to end break");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-5 border border-border rounded-xl">
              <Skeleton className="h-10 w-10 rounded-xl mb-3" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        <div className="border border-border rounded-xl overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-border last:border-b-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const allRecords = history;
  const totalHours = allRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
        <p className="text-muted-foreground mt-1">Track your work hours</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
              <Clock className="text-emerald-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {todayRecord?.total_hours?.toFixed(1) || "0.0"}h
            </p>
            <p className="text-sm text-muted-foreground">Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
              <History className="text-amber-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-foreground">{total}</p>
            <p className="text-sm text-muted-foreground">Days Recorded</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-3">
              <Clock className="text-purple-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-foreground">{totalHours.toFixed(1)}h</p>
            <p className="text-sm text-muted-foreground">Net Hours</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock size={20} className="text-emerald-600" />
            Today&apos;s Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayRecord ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-muted rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <LogIn size={16} className="text-emerald-600" />
                    Clock In
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    {new Date(todayRecord.clock_in).toLocaleTimeString("en-IN")}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <LogOut size={16} className={todayRecord.clock_out ? "text-red-600" : "text-muted-foreground"} />
                    Clock Out
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    {todayRecord.clock_out ? new Date(todayRecord.clock_out).toLocaleTimeString("en-IN") : "Not yet"}
                  </p>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Clock size={16} className="text-amber-600" />
                    Break
                  </div>
                  <p className="text-lg font-semibold text-amber-700">
                    {todayRecord.break_start && !todayRecord.break_end ? "On break" : `${todayRecord.break_total?.toFixed(1) || "0.0"}h`}
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-r from-amber-50 to-emerald-50 rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Clock size={16} className="text-emerald-600" />
                    Net Hours
                  </div>
                  <p className="text-lg font-bold text-emerald-700">
                    {todayRecord.total_hours ? `${todayRecord.total_hours.toFixed(1)}h` : "In progress"}
                  </p>
                </div>
              </div>
              {!todayRecord.clock_out && (
                <div className="flex gap-2">
                  {todayRecord.break_start && !todayRecord.break_end ? (
                    <Button variant="emerald" onClick={breakEnd}>
                      End Break
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={breakStart}>
                      Take Break
                    </Button>
                  )}
                  <Button variant="red" onClick={clockOut}>
                    <LogOut size={18} /> Clock Out
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock size={48} className="mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">You haven&apos;t clocked in today</p>
              <Button onClick={clockIn}>
                <LogIn size={18} /> Clock In Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead className="text-center">Break</TableHead>
                <TableHead className="text-right">Net Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allRecords.map((record: any) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    {new Date(record.date).toLocaleDateString("en-IN", {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell>{record.clock_in ? new Date(record.clock_in).toLocaleTimeString("en-IN") : "-"}</TableCell>
                  <TableCell>{record.clock_out ? new Date(record.clock_out).toLocaleTimeString("en-IN") : "-"}</TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {record.break_total ? `${record.break_total.toFixed(1)}h` : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {record.total_hours ? (
                      <span className="text-emerald-700 font-medium">{record.total_hours.toFixed(1)}h</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {allRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
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
