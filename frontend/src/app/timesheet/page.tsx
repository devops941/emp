"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { getSocket } from "@/lib/socket";

export default function TimesheetPage() {
  const { token } = useAuth();
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().slice(0, 10);
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimesheet();
  }, [weekStart]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socket.on("timer_started", loadTimesheet);
    socket.on("timer_stopped", loadTimesheet);
    return () => {
      socket.off("timer_started", loadTimesheet);
      socket.off("timer_stopped", loadTimesheet);
    };
  }, [token, weekStart]);

  const loadTimesheet = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/timings/timesheet", { params: { week_start: weekStart } });
      setData(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const shiftWeek = (direction: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + direction * 7);
    setWeekStart(d.toISOString().slice(0, 10));
  };

  const formatDateRange = () => {
    if (!weekStart) return "";
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
  };

  const totalWeek = data?.items?.reduce((sum: number, item: any) => sum + item.total, 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Weekly Timesheet</h1>
        <p className="text-muted-foreground mt-1">Track hours per task across the week</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)}>
            <ChevronLeft size={16} /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => shiftWeek(1)}>
            Next <ChevronRight size={16} />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-emerald-600" />
          <span className="text-sm font-medium text-foreground">{formatDateRange()}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          Total: <strong className="text-foreground">{totalWeek.toFixed(1)}h</strong>
        </span>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background">Task</TableHead>
                <TableHead>Project</TableHead>
                {data?.days?.map((d: string) => (
                  <TableHead key={d} className="text-center">{d}</TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="sticky left-0 bg-background"><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    {data?.days?.map((d: string) => (
                      <TableCell key={d} className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    ))}
                    <TableCell className="text-right"><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data?.items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={data?.days?.length ? data.days.length + 3 : 10} className="text-center py-12 text-muted-foreground">
                    No time logged this week
                  </TableCell>
                </TableRow>
              ) : (
                data?.items?.map((item: any) => (
                  <TableRow key={item.task_id}>
                    <TableCell className="font-medium text-foreground min-w-[200px]">{item.task_title}</TableCell>
                    <TableCell className="text-muted-foreground">{item.project_name || "-"}</TableCell>
                    {data.days.map((_: string, i: number) => (
                      <TableCell key={i} className="text-center">
                        {item.days[i] > 0 ? (
                          <span className="font-medium text-foreground">{item.days[i].toFixed(1)}h</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-semibold text-emerald-700">{item.total.toFixed(1)}h</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
