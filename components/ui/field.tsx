import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type FieldShellProps = {
  children: React.ReactNode;
  error?: string;
  helper?: string;
  label: string;
};

export function FieldShell({ children, error, helper, label }: FieldShellProps) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium">
      {label}
      {children}
      {helper ? <span className="text-sm font-normal text-muted">{helper}</span> : null}
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </label>
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-12 w-full min-w-0 rounded-lg border border-border bg-background px-4 text-base outline-none transition focus:border-primary",
        className,
      )}
      {...props}
    />
  );
}

export function SelectInput({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-12 w-full min-w-0 rounded-lg border border-border bg-background px-4 text-base outline-none transition focus:border-primary",
        className,
      )}
      {...props}
    />
  );
}
