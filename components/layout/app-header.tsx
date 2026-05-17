import { Wallet } from "lucide-react";

import { SignOutButton } from "@/features/auth/components/sign-out-button";

type AppHeaderProps = {
  subtitle?: string;
  title: string;
  workspaceName: string;
};

export function AppHeader({ subtitle, title, workspaceName }: AppHeaderProps) {
  return (
    <header className="flex min-w-0 items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-muted">{workspaceName}</p>
        <h1 className="truncate text-2xl font-bold leading-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <SignOutButton />
        <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-white">
          <Wallet aria-hidden="true" size={22} />
        </div>
      </div>
    </header>
  );
}
