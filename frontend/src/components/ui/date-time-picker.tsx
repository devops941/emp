"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  parse,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isToday,
} from "date-fns";
import { Button } from "./button";
import { cn } from "@/lib/utils";

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date and time",
  disabled = false,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse datetime-local format "yyyy-MM-ddTHH:mm"
  const parseDatetime = (val: string) => {
    if (!val) return { date: new Date(), time: "00:00" };
    const [datePart, timePart] = val.split("T");
    return {
      date: parse(datePart, "yyyy-MM-dd", new Date()),
      time: timePart || "00:00",
    };
  };

  const { date: selectedDate, time: selectedTime } = parseDatetime(value);
  const [month, setMonth] = React.useState(selectedDate);
  const [timeInput, setTimeInput] = React.useState(selectedTime);

  // Sync when value changes externally
  React.useEffect(() => {
    if (value) {
      const { date, time } = parseDatetime(value);
      setMonth(date);
      setTimeInput(time);
    }
  }, [value]);

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const datetimeStr = `${dateStr}T${timeInput}`;
    onChange(datetimeStr);
    setOpen(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTimeInput(newTime);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const datetimeStr = `${dateStr}T${newTime}`;
    onChange(datetimeStr);
  };

  const formattedValue = value
    ? format(
        parse(value.split("T")[0], "yyyy-MM-dd", new Date()),
        "MMM d, yyyy"
      ) +
      " " +
      selectedTime
    : placeholder;

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = (getDay(monthStart) + 6) % 7;

  const valueDate = value.split("T")[0];

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "w-full flex items-center gap-2 border border-input rounded-md px-3 py-2 text-sm text-left bg-background transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:border-input/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            className
          )}
        >
          <CalendarIcon size={16} className="text-muted-foreground flex-shrink-0" />
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {formattedValue}
          </span>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Content
        align="start"
        className="z-50 bg-background border border-border rounded-xl shadow-lg p-3 w-[280px]"
      >
        <div>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonth(subMonths(month, 1))}
              className="h-8 w-8"
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-semibold text-foreground">
              {format(month, "MMMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonth(addMonths(month, 1))}
              className="h-8 w-8"
            >
              <ChevronRight size={16} />
            </Button>
          </div>

          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEK_DAYS.map((d) => (
              <div
                key={d}
                className="text-center text-[11px] font-medium text-muted-foreground py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const isSelected = valueDate === dateStr;
              const isCurrentMonth =
                day.getMonth() === month.getMonth() &&
                day.getFullYear() === month.getFullYear();
              const isTodayDate = isToday(day);

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "cursor-pointer rounded-lg text-center text-sm py-1.5 transition-colors",
                    isSelected
                      ? "bg-emerald-500 text-white hover:bg-emerald-600 font-semibold"
                      : isCurrentMonth
                        ? isTodayDate
                          ? "font-bold text-emerald-600 hover:bg-muted"
                          : "hover:bg-muted text-foreground"
                        : "text-muted-foreground/50 hover:bg-muted/30"
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          {/* Time input */}
          <div className="border-t border-border pt-3">
            <label className="text-xs font-medium text-muted-foreground block mb-2">
              Time
            </label>
            <input
              type="time"
              value={timeInput}
              onChange={handleTimeChange}
              className={cn(
                "w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
            />
          </div>
        </div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  );
}
