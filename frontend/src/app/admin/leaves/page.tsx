"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { CalendarOff, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAlert } from "@/context/AlertContext";
import Pagination from "@/components/Pagination";

interface Leave {
  id: string;
  user_id: string;
  user_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: string;
  admin_comment?: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = { sick: "Sick", casual: "Casual", pto: "PTO", half_day: "Half Day" };
const TYPE_COLORS: Record<string, string> = { sick: "bg-red-100 text-red-700", casual: "bg-blue-100 text-blue-700", pto: "bg-purple-100 text-purple-700", half_day: "bg-amber-100 text-amber-700" };
const STATUS_COLORS: Record<string, string> = { pending: "bg-amber-100 text-amber-700", approved: "bg-emerald-100 text-emerald-700", rejected: "bg-red-100 text-red-700" };

export default function AdminLeavesPage() {
  const alert = useAlert();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actionLeave, setActionLeave] = useState<Leave | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [adminComment, setAdminComment] = useState("");
  const perPage = 15;

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/leaves/", { params: { page, per_page: perPage, status: statusFilter || undefined } });
      setLeaves(res.data.items);
      setTotal(res.data.total);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [page, statusFilter]);

  const handleAction = async () => {
    if (!actionLeave || !actionType) return;
    try {
      await api.put(`/api/leaves/${actionLeave.id}`, { status: actionType === "approve" ? "approved" : "rejected", admin_comment: adminComment || null });
      alert.success(`Leave ${actionType === "approve" ? "approved" : "rejected"} successfully`);
      setActionLeave(null);
      setAdminComment("");
      loadData();
    } catch (err: any) {
      alert.error(err.response?.data?.detail || "Action failed");
    }
  };

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leave Requests</h1>
        <p className="text-muted-foreground mt-1">Review and manage employee leave requests</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { key: "pending", label: "Pending", icon: Clock },
          { key: "approved", label: "Approved", icon: CheckCircle },
          { key: "rejected", label: "Rejected", icon: XCircle },
        ].map(({ key, label, icon: Icon }) => (
          <Card key={key} className="cursor-pointer" onClick={() => setStatusFilter(key)}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <Icon size={20} className={`${key === "pending" ? "text-amber-600" : key === "approved" ? "text-emerald-600" : "text-red-600"}`} />
                <div>
                  <p className="text-2xl font-bold">{total}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><CalendarOff size={20} className="text-amber-600" />All Leave Requests</CardTitle>
            <div className="flex gap-2">
              {["", "pending", "approved", "rejected"].map((s) => (
                <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => { setStatusFilter(s); setPage(1); }}>
                  {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-center">Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.user_name}</TableCell>
                  <TableCell><Badge className={`text-xs ${TYPE_COLORS[l.leave_type] || ""}`}>{TYPE_LABELS[l.leave_type] || l.leave_type}</Badge></TableCell>
                  <TableCell className="text-sm">{l.start_date}</TableCell>
                  <TableCell className="text-sm">{l.end_date}</TableCell>
                  <TableCell className="text-center font-medium">{l.days}</TableCell>
                  <TableCell className="text-sm max-w-40 truncate">{l.reason}</TableCell>
                  <TableCell className="text-center"><Badge className={`text-xs ${STATUS_COLORS[l.status] || ""}`}>{l.status}</Badge></TableCell>
                  <TableCell className="text-center">
                    {l.status === "pending" && (
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2" onClick={() => { setActionLeave(l); setActionType("approve"); }}>Approve</Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 h-7 px-2" onClick={() => { setActionLeave(l); setActionType("reject"); }}>Reject</Button>
                      </div>
                    )}
                    {l.status !== "pending" && l.admin_comment && <p className="text-xs text-muted-foreground">{l.admin_comment}</p>}
                  </TableCell>
                </TableRow>
              ))}
              {leaves.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No leave requests found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <div className="px-4"><Pagination page={page} perPage={perPage} total={total} onPageChange={setPage} /></div>
        </CardContent>
      </Card>

      <Dialog open={!!actionLeave} onOpenChange={() => { setActionLeave(null); setAdminComment(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={actionType === "approve" ? "text-emerald-700" : "text-red-700"}>
              {actionType === "approve" ? "Approve" : "Reject"} Leave Request
            </DialogTitle>
          </DialogHeader>
          {actionLeave && (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-muted rounded-xl space-y-1 text-sm">
                <p><span className="text-muted-foreground">Employee:</span> {actionLeave.user_name}</p>
                <p><span className="text-muted-foreground">Type:</span> {TYPE_LABELS[actionLeave.leave_type]}</p>
                <p><span className="text-muted-foreground">Period:</span> {actionLeave.start_date} → {actionLeave.end_date} ({actionLeave.days} days)</p>
                <p><span className="text-muted-foreground">Reason:</span> {actionLeave.reason}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Comment (optional)</label>
                <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[70px] resize-none" placeholder="Add a comment for the employee..." value={adminComment} onChange={(e) => setAdminComment(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionLeave(null); setAdminComment(""); }}>Cancel</Button>
            <Button className={actionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"} onClick={handleAction}>
              {actionType === "approve" ? <CheckCircle size={16} /> : <XCircle size={16} />}
              {actionType === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
