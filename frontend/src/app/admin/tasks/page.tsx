"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Search, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    title: "", description: "", project_id: "", assigned_to: "",
    priority: "medium", status: "pending", deadline: "",
  });

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    try {
      const params: any = {};
      if (filterStatus !== "all") params.status = filterStatus;
      const [tasksRes, empRes, projRes] = await Promise.all([
        api.get("/api/tasks", { params }),
        api.get("/api/users"),
        api.get("/api/projects"),
      ]);
      setTasks(tasksRes.data);
      setEmployees(empRes.data.filter((u: any) => u.role === "employee"));
      setProjects(projRes.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        project_id: form.project_id || null,
        assigned_to: form.assigned_to || null,
      };
      if (editing) {
        await api.put(`/api/tasks/${editing.id}`, payload);
        toast.success("Task updated");
      } else {
        await api.post("/api/tasks", payload);
        toast.success("Task created");
      }
      setShowModal(false);
      setEditing(null);
      setForm({ title: "", description: "", project_id: "", assigned_to: "", priority: "medium", status: "pending", deadline: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await api.delete(`/api/tasks/${id}`);
      toast.success("Task deleted");
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to delete");
    }
  };

  const openEdit = (task: any) => {
    setEditing(task);
    setForm({
      title: task.title, description: task.description || "",
      project_id: task.project_id || "", assigned_to: task.assigned_to || "",
      priority: task.priority, status: task.status,
      deadline: task.deadline ? task.deadline.slice(0, 16) : "",
    });
    setShowModal(true);
  };

  const filtered = tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage all tasks</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ title: "", description: "", project_id: "", assigned_to: "", priority: "medium", status: "pending", deadline: "" }); setShowModal(true); }}>
          <Plus size={18} /> Add Task
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input type="text" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "in_progress", "completed", "cancelled"].map((f) => (
            <Button key={f} variant={filterStatus === f ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(f)}>
              {f.replace("_", " ").charAt(0).toUpperCase() + f.slice(1).replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((task: any) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium text-foreground">{task.title}</TableCell>
              <TableCell className="text-muted-foreground">{task.assigned_name || "Unassigned"}</TableCell>
              <TableCell className="text-muted-foreground">{task.project_name || "-"}</TableCell>
              <TableCell><Badge variant={task.priority as any}>{task.priority}</Badge></TableCell>
              <TableCell><Badge variant={task.status as any}>{task.status}</Badge></TableCell>
              <TableCell className="text-muted-foreground">
                {task.deadline ? new Date(task.deadline).toLocaleDateString("en-IN") : "-"}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => openEdit(task)}><Edit2 size={16} /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(task.id)} className="text-red-500 hover:text-red-600"><Trash2 size={16} /></Button>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">No tasks found</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Task" : "Create Task"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No project</SelectItem>
                    {projects.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Assigned To</Label>
                <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {employees.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Deadline</Label>
              <Input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">{editing ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
