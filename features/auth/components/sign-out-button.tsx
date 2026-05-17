"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-foreground shadow-[var(--shadow)] transition hover:bg-surface-muted"
      onClick={() => signOut({ callbackUrl: "/sign-in" })}
      type="button"
    >
      <LogOut aria-hidden="true" size={18} />
      Salir
    </button>
  );
}
