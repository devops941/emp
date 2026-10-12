"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, Search, Edit2, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", manager_id: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [deptRes, usersRes] = await Promise.all([
        api.get("/api/departments"),
        api.get("/api/users"),
      ]);
      setDepartments(deptRes.data);
      setUsers(usersRes.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: form.name,
        description: form.description || null,
        manager_id: form.manager_id || null,
      };
      if (editing) {
        await api.put(`/api/departments/${editing.id}`, payload);
        toast.success("Department updated");
      } else {
        await api.post("/api/departments", payload);
        toast.success("Department created");
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: "", description: "", manager_id: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to save");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/departments/${id}`);
      toast.success("Department deleted");
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to delete");
    }
  };

  const openEdit = (dept: any) => {
    setEditing(dept);
    setForm({
      name: dept.name,
      description: dept.description || "",
      manager_id: dept.manager_id || "",
    });
    setShowModal(true);
  };

  const getManagerName = (managerId: string) => {
    const user = users.find((u) => u.id === managerId);
    return user ? user.name : "-";
  };

  const filtered = departments.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 size={28} className="text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Departments</h1>
            <p className="text-muted-foreground mt-1">Manage your organization departments</p>
          </div>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ name: "", description: "", manager_id: "" }); setShowModal(true); }}>
          <Plus size={18} /> Add Department
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input type="text" placeholder="Search departments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Manager</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((dept: any) => (
            <TableRow key={dept.id}>
              <TableCell className="font-medium text-foreground">{dept.name}</TableCell>
              <TableCell className="text-muted-foreground">{dept.description || "-"}</TableCell>
              <TableCell className="text-muted-foreground">{dept.manager_id ? getManagerName(dept.manager_id) : "-"}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => openEdit(dept)}><Edit2 size={16} /></Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(dept.id)} className="text-red-500 hover:text-red-600"><Trash2 size={16} /></Button>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && !loading && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-12">No departments found</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title="Delete Department"
        description="This department will be permanently removed."
      />

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Department" : "Add Department"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Optional description" />
            </div>
            <div className="space-y-1.5">
              <Label>Manager</Label>
              <Select value={form.manager_id} onValueChange={(v) => setForm({ ...form, manager_id: v })}>
                <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No manager</SelectItem>
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
