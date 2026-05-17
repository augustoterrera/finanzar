"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesCombined,
  CreditCard,
  FolderKanban,
  List,
  Settings,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";

const items = [
  { href: "/dashboard", icon: ChartNoAxesCombined, label: "Inicio" },
  { href: "/accounts", icon: Wallet, label: "Ctas." },
  { href: "/transactions", icon: List, label: "Movs." },
  { href: "/cards", icon: CreditCard, label: "Tarj." },
  { href: "/projects", icon: FolderKanban, label: "Proy." },
  { href: "/settings", icon: Settings, label: "Ajustes" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-2 pb-[max(env(safe-area-inset-bottom),0.55rem)] pt-2 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-6 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "grid min-h-12 min-w-0 place-items-center gap-1 rounded-lg px-0.5 text-[0.67rem] font-semibold leading-none text-muted transition",
                isActive && "bg-surface-muted text-primary",
              )}
              href={item.href}
              key={item.href}
            >
              <Icon aria-hidden="true" size={19} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
