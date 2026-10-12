"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Settings, Clock, Timer, TrendingUp, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAlert } from "@/context/AlertContext";
import { Skeleton } from "@/components/ui/skeleton";

interface AttendanceSettings {
  work_start_hour: number;
  work_start_minute: number;
  late_threshold_minutes: number;
  standard_hours: number;
  min_hours_half_day: number;
}

export default function AttendanceSettingsPage() {
  const alert = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AttendanceSettings>({
    work_start_hour: 9,
    work_start_minute: 0,
    late_threshold_minutes: 30,
    standard_hours: 8,
    min_hours_half_day: 4.5,
  });

  useEffect(() => {
    api.get("/api/settings/attendance")
      .then((res) => setSettings(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put("/api/settings/attendance", settings);
      setSettings(res.data);
      alert.success("Attendance settings saved successfully");
    } catch (err: any) {
      alert.error(err.response?.data?.detail || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof AttendanceSettings, value: number) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  // Compute late time for preview
  const totalLateMins = settings.work_start_hour * 60 + settings.work_start_minute + settings.late_threshold_minutes;
  const lateHour = Math.floor(totalLateMins / 60);
  const lateMinute = totalLateMins % 60;
  const fmt = (h: number, m: number) =>
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attendance Settings</h1>
        <p className="text-muted-foreground mt-1">Configure punch-in rules applied to all employees</p>
      </div>

      {/* Live preview banner */}
      <div className="flex flex-wrap gap-4 p-4 bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl text-sm">
        <span className="flex items-center gap-2 text-emerald-700 font-medium">
          <Clock size={16} />
          Work starts at <strong>{fmt(settings.work_start_hour, settings.work_start_minute)}</strong>
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="flex items-center gap-2 text-red-600 font-medium">
          <Timer size={16} />
          Late after <strong>{fmt(lateHour, lateMinute)}</strong>
          <span className="text-muted-foreground font-normal">({settings.late_threshold_minutes} min grace)</span>
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="flex items-center gap-2 text-blue-700 font-medium">
          <TrendingUp size={16} />
          OT after <strong>{settings.standard_hours}h</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Work Start Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock size={18} className="text-emerald-600" />
              Work Start Time
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Official start time. Late threshold is calculated from this.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Hour (0-23)</label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={settings.work_start_hour}
                  onChange={(e) => set("work_start_hour", Number(e.target.value))}
                />
              </div>
              <span className="text-xl font-bold text-muted-foreground mt-5">:</span>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Minute (0-59)</label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={settings.work_start_minute}
                  onChange={(e) => set("work_start_minute", Number(e.target.value))}
                />
              </div>
            </div>
            <p className="text-xs text-emerald-600 font-medium">
              Start: {fmt(settings.work_start_hour, settings.work_start_minute)}
            </p>
          </CardContent>
        </Card>

        {/* Late Threshold */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer size={18} className="text-red-500" />
              Late Arrival Threshold
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Grace period after work start. Employees clocking in after this are marked late.
            </p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Grace Period (minutes)</label>
              <Input
                type="number"
                min={0}
                max={120}
                value={settings.late_threshold_minutes}
                onChange={(e) => set("late_threshold_minutes", Number(e.target.value))}
              />
            </div>
            <p className="text-xs text-red-500 font-medium">
              Late after: {fmt(lateHour, lateMinute)}
            </p>
          </CardContent>
        </Card>

        {/* Standard Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp size={18} className="text-purple-600" />
              Standard Work Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Expected daily work hours. Hours above this are counted as overtime.
            </p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Hours per day</label>
              <Input
                type="number"
                min={1}
                max={24}
                step={0.5}
                value={settings.standard_hours}
                onChange={(e) => set("standard_hours", Number(e.target.value))}
              />
            </div>
            <p className="text-xs text-purple-600 font-medium">
              Overtime kicks in after {settings.standard_hours}h
            </p>
          </CardContent>
        </Card>

        {/* Half Day */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings size={18} className="text-amber-600" />
              Half Day Threshold
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Minimum hours to be marked &quot;Present&quot;. Below this is a &quot;Half Day&quot;.
            </p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Minimum hours</label>
              <Input
                type="number"
                min={0.5}
                max={12}
                step={0.5}
                value={settings.min_hours_half_day}
                onChange={(e) => set("min_hours_half_day", Number(e.target.value))}
              />
            </div>
            <p className="text-xs text-amber-600 font-medium">
              Below {settings.min_hours_half_day}h - Half Day
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save size={16} />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
