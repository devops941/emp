"use client";

import { Badge } from "@/components/ui/badge";

export default function DeadlineBadge({ deadline }: { deadline: string | null | undefined }) {
  if (!deadline) return null;

  const now = new Date();
  const due = new Date(deadline);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0)
    return <Badge variant="destructive">Overdue by {Math.abs(diffDays)}d</Badge>;
  if (diffDays === 0)
    return <Badge variant="destructive">Due today</Badge>;
  if (diffDays === 1)
    return <Badge variant="high">Due tomorrow</Badge>;
  if (diffDays <= 3)
    return <Badge variant="medium">Due in {diffDays}d</Badge>;

  return null;
}
