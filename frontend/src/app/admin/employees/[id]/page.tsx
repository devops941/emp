"use client";

import { useState, useEffect, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tasks" | "attendance" | "leaves">("tasks");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadEmployeeDetails();
  }, [id]);

  const loadEmployeeDetails = async () => {
    try {
      const res = await api.get(`/api/users/${id}/details`);
      setData(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to load employee details");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (rowId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "-";
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("en-IN");
    } catch {
      return "-";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.back()}>← Back</Button>
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => router.back()}>← Back</Button>
        <p className="text-muted-foreground">Employee not found</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-emerald-100 text-emerald-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const initials = data.name
    .split(" ")
    .map((n: string) => n.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.back()}>← Back</Button>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-6">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{data.name}</h1>
                <p className="text-muted-foreground mt-1">{data.email}</p>
                <div className="flex items-center gap-3 mt-3">
                  <Badge variant="default" className="bg-blue-100 text-blue-800 capitalize">
                    {data.role}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${data.is_active ? "bg-emerald-500" : "bg-red-500"}`}></div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {data.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-muted-foreground">Joined</p>
              <p className="text-sm font-semibold text-foreground">{formatDate(data.created_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.stats.total_tasks}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{data.stats.completed_tasks}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{data.stats.in_progress_tasks}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hours Worked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.stats.total_hours}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leave Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.leaves.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <div className="flex gap-2 mt-4 border-b">
            {["tasks", "attendance", "leaves"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as typeof activeTab)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {activeTab === "tasks" && (
            <div>
              {data.tasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No tasks assigned</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Est. Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tasks.map((task: any) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium text-foreground">{task.title}</TableCell>
                        <TableCell className="text-muted-foreground">{task.project_name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="default" className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className={getStatusColor(task.status)}>
                            {task.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(task.deadline)}
                        </TableCell>
                        <TableCell>{task.estimated_hours || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {activeTab === "attendance" && (
            <div>
              {data.attendance.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No attendance records</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Break Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Late</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.attendance.map((att: any) => (
                      <Fragment key={att.id}>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell onClick={() => toggleExpanded(att.id)}>
                            {att.breaks && att.breaks.length > 0 ? (
                              expandedRows.has(att.id) ? (
                                <ChevronUp size={18} />
                              ) : (
                                <ChevronDown size={18} />
                              )
                            ) : null}
                          </TableCell>
                          <TableCell className="font-medium">{formatDate(att.date)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatTime(att.clock_in)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatTime(att.clock_out)}</TableCell>
                          <TableCell>{att.total_hours ? att.total_hours.toFixed(2) : "-"}</TableCell>
                          <TableCell>{att.overtime_hours ? att.overtime_hours.toFixed(2) : "-"}</TableCell>
                          <TableCell>{att.break_total || "-"}</TableCell>
                          <TableCell>
                            <Badge
                              variant="default"
                              className={att.status === "present" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"}
                            >
                              {att.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{att.is_late ? "Yes" : "No"}</TableCell>
                        </TableRow>
                        {expandedRows.has(att.id) && att.breaks && att.breaks.length > 0 && (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={9} className="py-4">
                              <div className="ml-6 space-y-2">
                                <p className="text-sm font-semibold text-foreground">Breaks</p>
                                {att.breaks.map((brk: any, idx: number) => (
                                  <div key={idx} className="text-sm text-muted-foreground">
                                    <span className="inline-block min-w-24">{brk.type}:</span>
                                    <span>
                                      {formatTime(brk.start)} - {formatTime(brk.end) || "ongoing"} ({brk.duration_mins || "-"} mins)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {activeTab === "leaves" && (
            <div>
              {data.leaves.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No leave requests</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Admin Comment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.leaves.map((leave: any) => (
                      <TableRow key={leave.id}>
                        <TableCell className="font-medium">{leave.leave_type}</TableCell>
                        <TableCell>{formatDate(leave.start_date)}</TableCell>
                        <TableCell>{formatDate(leave.end_date)}</TableCell>
                        <TableCell>{leave.days}</TableCell>
                        <TableCell>
                          <Badge
                            variant="default"
                            className={
                              leave.status === "approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : leave.status === "rejected"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-amber-100 text-amber-800"
                            }
                          >
                            {leave.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{leave.reason}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{leave.admin_comment || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
