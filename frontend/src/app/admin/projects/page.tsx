"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Search, Edit2, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { getSocket } from "@/lib/socket";

export default function AdminProjectsPage() {
  const { token } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", status: "active", assigned_employees: [] as string[] });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socket.on("task_created", loadData);
    socket.on("task_deleted", loadData);
    return () => {
      socket.off("task_created", loadData);
      socket.off("task_deleted", loadData);
    };
  }, [token]);

  const loadData = async () => {
    try {
      const [projRes, empRes] = await Promise.all([api.get("/api/projects"), api.get("/api/users")]);
      setProjects(projRes.data);
      setEmployees(empRes.data.filter((u: any) => u.role === "employee" || u.role === "admin"));
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        const updateData: any = {};
        if (form.name) updateData.name = form.name;
        updateData.description = form.description;
        updateData.status = form.status;
        updateData.assigned_employees = form.assigned_employees;
        await api.put(`/api/projects/${editing.id}`, updateData);
        toast.success("Project updated");
      } else {
        await api.post("/api/projects", form);
        toast.success("Project created");
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: "", description: "", status: "active", assigned_employees: [] });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/projects/${id}`);
      toast.success("Project deleted");
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to delete");
    }
  };

  const openEdit = (proj: any) => {
    setEditing(proj);
    setForm({ name: proj.name, description: proj.description, status: proj.status, assigned_employees: proj.assigned_employees || [] });
    setShowModal(true);
  };

  const toggleEmployee = (empId: string) => {
    setForm((prev) => ({
      ...prev,
      assigned_employees: prev.assigned_employees.includes(empId)
        ? prev.assigned_employees.filter((id) => id !== empId)
        : [...prev.assigned_employees, empId],
    }));
  };

  const filtered = projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage your projects</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ name: "", description: "", status: "active", assigned_employees: [] }); setShowModal(true); }}>
          <Plus size={18} /> Add Project
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input type="text" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((proj: any) => (
          <Card key={proj.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-foreground">{proj.name}</h3>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(proj)}><Edit2 size={14} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(proj.id)} className="text-red-500 hover:text-red-600"><Trash2 size={14} /></Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{proj.description || "No description"}</p>
              <div className="flex items-center justify-between">
                <Badge variant={proj.status === "active" ? "active" : "default"}>{proj.status}</Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users size={14} /> {proj.assigned_employees?.length || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">No projects found</div>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title="Delete Project"
        description="This project will be permanently removed. Associated task data will be preserved."
      />

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Project" : "Add Project"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned Employees</Label>
              <div className="max-h-40 overflow-y-auto border border-input rounded-xl p-2 space-y-1">
                {employees.map((emp: any) => (
                  <label key={emp.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-lg cursor-pointer">
                    <input type="checkbox" checked={form.assigned_employees.includes(emp.id)}
                      onChange={() => toggleEmployee(emp.id)} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.email}</p>
                    </div>
                  </label>
                ))}
              </div>
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
