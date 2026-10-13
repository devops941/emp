"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, isToday,
} from "date-fns";

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface CalendarProps {
  month: Date;
  onMonthChange: (m: Date) => void;
  renderDay?: (date: Date, dateStr: string) => React.ReactNode;
}

export function Calendar({ month, onMonthChange, renderDay }: CalendarProps) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = (getDay(monthStart) + 6) % 7;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={() => onMonthChange(subMonths(month, 1))}>
          <ChevronLeft size={16} />
        </Button>
        <span className="text-sm font-semibold text-foreground">
          {format(month, "MMMM yyyy")}
        </span>
        <Button variant="outline" size="icon" onClick={() => onMonthChange(addMonths(month, 1))}>
          <ChevronRight size={16} />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEK_DAYS.map((d) => (
          <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const today = isToday(day);
          return (
            <div
              key={dateStr}
              className={`relative flex flex-col items-center rounded-xl p-1.5 min-h-[52px] ${
                today ? "ring-2 ring-emerald-500 ring-offset-1 bg-emerald-50" : "bg-muted/30"
              }`}
            >
              <span className={`text-[11px] font-semibold mb-1 ${today ? "text-emerald-600" : "text-foreground"}`}>
                {format(day, "d")}
              </span>
              {renderDay?.(day, dateStr)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
