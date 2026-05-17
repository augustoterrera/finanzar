import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "w-full min-w-0 overflow-hidden rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow)]",
        className,
      )}
      {...props}
    />
  );
}
