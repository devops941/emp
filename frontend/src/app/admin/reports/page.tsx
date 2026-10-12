"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminReportsPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [attendanceForm, setAttendanceForm] = useState({
    month: String(currentMonth),
    year: String(currentYear),
    user_id: "",
  });
  const [tasksForm, setTasksForm] = useState({ status: "all", project_id: "" });
  const [leaveForm, setLeaveForm] = useState({ status: "all", user_id: "" });

  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingLeave, setLoadingLeave] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [empRes, projRes] = await Promise.all([
          api.get("/api/users"),
          api.get("/api/projects"),
        ]);
        setEmployees(empRes.data.filter((u: any) => u.role === "employee"));
        setProjects(projRes.data);
      } catch {}
    };
    loadData();
  }, []);

  const triggerDownload = (data: any, name: string) => {
    const blob = new Blob([data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAttendance = async () => {
    setLoadingAttendance(true);
    try {
      const params: any = {
        month: attendanceForm.month,
        year: attendanceForm.year,
      };
      if (attendanceForm.user_id) params.user_id = attendanceForm.user_id;
      const res = await api.get("/api/reports/attendance", { params, responseType: "blob" });
      triggerDownload(res.data, "attendance_report");
    } catch {
      toast.error("Failed to download attendance report");
    } finally {
      setLoadingAttendance(false);
    }
  };

  const downloadTasks = async () => {
    setLoadingTasks(true);
    try {
      const params: any = {};
      if (tasksForm.status !== "all") params.status = tasksForm.status;
      if (tasksForm.project_id) params.project_id = tasksForm.project_id;
      const res = await api.get("/api/reports/tasks", { params, responseType: "blob" });
      triggerDownload(res.data, "tasks_report");
    } catch {
      toast.error("Failed to download tasks report");
    } finally {
      setLoadingTasks(false);
    }
  };

  const downloadLeave = async () => {
    setLoadingLeave(true);
    try {
      const params: any = {};
      if (leaveForm.status !== "all") params.status = leaveForm.status;
      if (leaveForm.user_id) params.user_id = leaveForm.user_id;
      const res = await api.get("/api/reports/leaves", { params, responseType: "blob" });
      triggerDownload(res.data, "leave_report");
    } catch {
      toast.error("Failed to download leave report");
    } finally {
      setLoadingLeave(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports & Export</h1>
        <p className="text-muted-foreground mt-1">Download data as CSV files</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Attendance Report</h2>
            <p className="text-sm text-muted-foreground mt-1">Export monthly attendance records</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Month</Label>
              <Select value={attendanceForm.month} onValueChange={(v) => setAttendanceForm({ ...attendanceForm, month: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {new Date(2000, m - 1).toLocaleString("en-IN", { month: "long" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input
                type="number"
                value={attendanceForm.year}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, year: e.target.value })}
                min="2020"
                max="2099"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Employee (optional)</Label>
              <Select value={attendanceForm.user_id} onValueChange={(v) => setAttendanceForm({ ...attendanceForm, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="All employees" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All employees</SelectItem>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full" onClick={downloadAttendance} disabled={loadingAttendance}>
            <FileDown size={18} />
            {loadingAttendance ? "Downloading..." : "Download CSV"}
          </Button>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Tasks Report</h2>
            <p className="text-sm text-muted-foreground mt-1">Export task data with hours</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={tasksForm.status} onValueChange={(v) => setTasksForm({ ...tasksForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Project (optional)</Label>
              <Select value={tasksForm.project_id} onValueChange={(v) => setTasksForm({ ...tasksForm, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="All projects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All projects</SelectItem>
                  {projects.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full" onClick={downloadTasks} disabled={loadingTasks}>
            <FileDown size={18} />
            {loadingTasks ? "Downloading..." : "Download CSV"}
          </Button>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Leave Report</h2>
            <p className="text-sm text-muted-foreground mt-1">Export leave requests</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={leaveForm.status} onValueChange={(v) => setLeaveForm({ ...leaveForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Employee (optional)</Label>
              <Select value={leaveForm.user_id} onValueChange={(v) => setLeaveForm({ ...leaveForm, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="All employees" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All employees</SelectItem>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full" onClick={downloadLeave} disabled={loadingLeave}>
            <FileDown size={18} />
            {loadingLeave ? "Downloading..." : "Download CSV"}
          </Button>
        </div>
      </div>
    </div>
  );
}
