"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { Timer, Search, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/context/AuthContext";
import { getSocket } from "@/lib/socket";
import { DatePicker } from "@/components/ui/date-picker";
import { DateTimePicker } from "@/components/ui/date-time-picker";

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function AdminTimingsPage() {
  const { token } = useAuth();
  const [timings, setTimings] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualForm, setManualForm] = useState({ task_id: "", start_time: "", end_time: "", notes: "" });
  const perPage = 15;

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [filterUser, page, fromDate, toDate]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const reload = () => { setLoading(true); loadData(); };
    socket.on("timer_started", reload);
    socket.on("timer_stopped", reload);
    return () => {
      socket.off("timer_started", reload);
      socket.off("timer_stopped", reload);
    };
  }, [token, filterUser, page, fromDate, toDate]);

  const loadData = async () => {
    try {
      const params: any = { page, per_page: perPage };
      if (filterUser !== "all") params.user_id = filterUser;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const [timingsRes, empRes, tasksRes] = await Promise.all([
        api.get("/api/timings", { params }),
        api.get("/api/users"),
        api.get("/api/tasks/", { params: { per_page: 200 } }),
      ]);
      setTimings(timingsRes.data.items);
      setTotal(timingsRes.data.total);
      setEmployees(empRes.data);
      setTasks(tasksRes.data.items || tasksRes.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/timings/manual", {
        task_id: manualForm.task_id,
        start_time: new Date(manualForm.start_time).toISOString(),
        end_time: new Date(manualForm.end_time).toISOString(),
        notes: manualForm.notes,
      });
      toast.success("Time entry added");
      setShowManualEntry(false);
      setManualForm({ task_id: "", start_time: "", end_time: "", notes: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to add entry");
    }
  };

  const filtered = timings.filter((t) =>
    t.task_title?.toLowerCase().includes(search.toLowerCase()) ||
    t.user_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalDuration = filtered.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
  const manualCount = filtered.filter(t => t.is_manual).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 border border-border rounded-xl">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>
        <div className="border border-border rounded-xl overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-border last:border-b-0">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Time Tracking</h1>
          <p className="text-muted-foreground mt-1">View all time entries</p>
        </div>
        <Button onClick={() => setShowManualEntry(true)}>
          <Plus size={18} /> Add Manual Entry
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
              <Timer className="text-emerald-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-foreground">{total}</p>
            <p className="text-sm text-muted-foreground">Total Sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
              <Play className="text-amber-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-foreground">{filtered.filter((t) => t.is_running).length}</p>
            <p className="text-sm text-muted-foreground">Active Now</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-3">
              <Timer className="text-purple-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-foreground">{formatDuration(totalDuration)}</p>
            <p className="text-sm text-muted-foreground">Total Tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
              <Timer className="text-blue-600" size={20} />
            </div>
            <p className="text-2xl font-bold text-foreground">{manualCount}</p>
            <p className="text-sm text-muted-foreground">Manual Entries</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <DatePicker value={fromDate} onChange={setFromDate} placeholder="From date" />
        <DatePicker value={toDate} onChange={setToDate} placeholder="To date" />
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input type="text" placeholder="Search by task or user..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterUser} onValueChange={(v) => { setFilterUser(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Users" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {employees.map((emp: any) => (
              <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Task</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((t: any) => (
            <TableRow key={t.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs">{t.user_name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground">{t.user_name || "Unknown"}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{t.task_title || "Unknown Task"}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {t.start_time ? new Date(t.start_time).toLocaleString("en-IN") : "-"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {t.end_time ? new Date(t.end_time).toLocaleString("en-IN") : "-"}
              </TableCell>
              <TableCell className="font-medium">
                {t.is_running ? "Running..." : (t.duration_minutes ? formatDuration(t.duration_minutes) : "-")}
              </TableCell>
              <TableCell>
                {t.is_running ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Active
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">Completed</span>
                )}
                {t.is_manual && (
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full ml-1">Manual</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">No timings found</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination page={page} perPage={perPage} total={total} onPageChange={setPage} />

      <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Manual Time Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Task</Label>
              <Select value={manualForm.task_id} onValueChange={v => setManualForm({...manualForm, task_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select task" /></SelectTrigger>
                <SelectContent>
                  {tasks.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <DateTimePicker value={manualForm.start_time} onChange={v => setManualForm({...manualForm, start_time: v})} placeholder="Select start" />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <DateTimePicker value={manualForm.end_time} onChange={v => setManualForm({...manualForm, end_time: v})} placeholder="Select end" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input type="text" value={manualForm.notes} onChange={e => setManualForm({...manualForm, notes: e.target.value})} placeholder="What did you work on?" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowManualEntry(false)}>Cancel</Button>
              <Button type="submit">Add Entry</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
