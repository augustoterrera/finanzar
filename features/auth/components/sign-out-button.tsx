"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      aria-label="Salir"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-foreground shadow-[var(--shadow)] transition hover:bg-surface-muted"
      onClick={() => signOut({ callbackUrl: "/sign-in" })}
      type="button"
    >
      <LogOut aria-hidden="true" size={18} />
    </button>
  );
}
