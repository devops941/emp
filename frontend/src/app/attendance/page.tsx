"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Clock, LogIn, LogOut, History } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AttendancePage() {
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [todayRes, historyRes] = await Promise.all([
        api.get("/api/attendance/today").catch(() => null),
        api.get("/api/attendance"),
      ]);
      setTodayRecord(todayRes?.data || null);
      setHistory(historyRes.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const clockIn = async () => {
    try {
      const res = await api.post("/api/attendance/clock-in");
      setTodayRecord(res.data);
      toast.success("Clocked in successfully!");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to clock in");
    }
  };

  const clockOut = async () => {
    try {
      const res = await api.post("/api/attendance/clock-out");
      setTodayRecord(res.data);
      toast.success("Clocked out successfully!");
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to clock out");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const totalHours = history.reduce((sum, r) => sum + (r.total_hours || 0), 0);

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
            <p className="text-2xl font-bold text-foreground">{history.length}</p>
            <p className="text-sm text-muted-foreground">Days Recorded</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-3">
              <Clock className="text-purple-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-foreground">{totalHours.toFixed(1)}h</p>
            <p className="text-sm text-muted-foreground">Total Hours</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <div className="p-4 bg-gradient-to-r from-amber-50 to-emerald-50 rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Clock size={16} className="text-emerald-600" />
                    Total Hours
                  </div>
                  <p className="text-lg font-bold text-emerald-700">
                    {todayRecord.total_hours ? `${todayRecord.total_hours.toFixed(1)}h` : "In progress"}
                  </p>
                </div>
              </div>
              {!todayRecord.clock_out && (
                <Button variant="red" onClick={clockOut}>
                  <LogOut size={18} /> Clock Out
                </Button>
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
                <TableHead className="text-right">Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((record: any) => (
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
                  <TableCell className="text-right">
                    {record.total_hours ? (
                      <span className="text-emerald-700 font-medium">{record.total_hours.toFixed(1)}h</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                    No attendance records found
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
