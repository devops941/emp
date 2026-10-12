"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { CalendarOff, Plus, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAlert } from "@/context/AlertContext";
import Pagination from "@/components/Pagination";

interface Leave {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: string;
  admin_comment?: string;
  created_at: string;
}

interface Balance {
  total: number;
  used: number;
  remaining: number;
}

const LEAVE_TYPES = ["sick", "casual", "pto", "half_day"];
const TYPE_LABELS: Record<string, string> = { sick: "Sick Leave", casual: "Casual Leave", pto: "PTO / Vacation", half_day: "Half Day" };
const TYPE_COLORS: Record<string, string> = { sick: "bg-red-100 text-red-700", casual: "bg-blue-100 text-blue-700", pto: "bg-purple-100 text-purple-700", half_day: "bg-amber-100 text-amber-700" };
const STATUS_COLORS: Record<string, string> = { pending: "bg-amber-100 text-amber-700", approved: "bg-emerald-100 text-emerald-700", rejected: "bg-red-100 text-red-700" };

export default function LeavesPage() {
  const alert = useAlert();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [balance, setBalance] = useState<Record<string, Balance> | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ leave_type: "casual", start_date: "", end_date: "", reason: "" });

  const loadData = async () => {
    try {
      const [leavesRes, balanceRes] = await Promise.all([
        api.get("/api/leaves/", { params: { page, per_page: perPage } }),
        api.get("/api/leaves/balance"),
      ]);
      setLeaves(leavesRes.data.items);
      setTotal(leavesRes.data.total);
      setBalance(balanceRes.data);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [page]);

  const handleSubmit = async () => {
    if (!form.start_date || !form.end_date || !form.reason.trim()) {
      alert.error("Please fill all fields");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/leaves/", form);
      alert.success("Leave request submitted successfully");
      setShowForm(false);
      setForm({ leave_type: "casual", start_date: "", end_date: "", reason: "" });
      loadData();
    } catch (err: any) {
      alert.error(err.response?.data?.detail || "Failed to submit leave request");
    } finally { setSubmitting(false); }
  };

  const handleCancel = async (id: string) => {
    try {
      await api.delete(`/api/leaves/${id}`);
      alert.success("Leave request cancelled");
      loadData();
    } catch (err: any) {
      alert.error(err.response?.data?.detail || "Failed to cancel");
    }
  };

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Leaves</h1>
          <p className="text-muted-foreground mt-1">Apply and track your leave requests</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={16} /> Apply Leave</Button>
      </div>

      {balance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(balance).map(([type, b]) => (
            <Card key={type}>
              <CardContent className="p-5">
                <p className="text-xs font-medium text-muted-foreground mb-1">{TYPE_LABELS[type] || type}</p>
                <p className="text-2xl font-bold">{b.remaining}<span className="text-sm text-muted-foreground font-normal">/{b.total}</span></p>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(0, (b.remaining / b.total) * 100)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{b.used} used</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarOff size={20} className="text-amber-600" />Leave History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-center">Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.map((l) => (
                <TableRow key={l.id}>
                  <TableCell><Badge className={`text-xs ${TYPE_COLORS[l.leave_type] || ""}`}>{TYPE_LABELS[l.leave_type] || l.leave_type}</Badge></TableCell>
                  <TableCell className="text-sm">{l.start_date}</TableCell>
                  <TableCell className="text-sm">{l.end_date}</TableCell>
                  <TableCell className="text-center font-medium">{l.days}</TableCell>
                  <TableCell className="text-sm max-w-48 truncate">{l.reason}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={`text-xs ${STATUS_COLORS[l.status] || ""}`}>
                      {l.status === "pending" && <Clock size={11} className="mr-1" />}
                      {l.status === "approved" && <CheckCircle size={11} className="mr-1" />}
                      {l.status === "rejected" && <XCircle size={11} className="mr-1" />}
                      {l.status}
                    </Badge>
                    {l.admin_comment && <p className="text-xs text-muted-foreground mt-1">{l.admin_comment}</p>}
                  </TableCell>
                  <TableCell>
                    {l.status === "pending" && (
                      <Button variant="outline" size="sm" onClick={() => handleCancel(l.id)}>Cancel</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {leaves.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No leave requests found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <div className="px-4"><Pagination page={page} perPage={perPage} total={total} onPageChange={setPage} /></div>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Leave Type</label>
              <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">From Date</label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">To Date</label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} disabled={form.leave_type === "half_day"} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Reason</label>
              <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px] resize-none" placeholder="Briefly describe your reason..." value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting && <Loader2 size={16} className="animate-spin mr-1" />}Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
