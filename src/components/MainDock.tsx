"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Home, 
  ArrowRightLeft, 
  Repeat, 
  Plus, 
  Users, 
  Wallet,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/SignOutButton";

const NAV_LEFT = [
  { href: "/", icon: Home, label: "Inicio" },
  { href: "/movimientos", icon: ArrowRightLeft, label: "Movimientos" },
  { href: "/recurrentes", icon: Repeat, label: "Recurrentes" },
];

const NAV_RIGHT = [
  { href: "/personas", icon: Users, label: "Personas" },
  { href: "/medios-de-pago", icon: Wallet, label: "Medios de pago" },
  { href: "/conexiones-ia", icon: Bot, label: "Conexiones con IA" },
];

export function MainDock() {
  const pathname = usePathname();
  if (pathname.startsWith('/login')) return null;

  const renderIconLink = (item: { href: string; icon: typeof Home; label: string }) => {
    const isActive = item.href === "/conexiones-ia" ? pathname.startsWith(item.href) : pathname === item.href;
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "relative flex items-center justify-center w-10 h-10 rounded-full transition-colors",
          isActive 
            ? "text-blue-600 dark:text-blue-400" 
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        )}
        aria-label={item.label}
      >
        {isActive && (
          <motion.div
            layoutId="mobile-nav-active"
            className="absolute inset-0 bg-blue-50/80 dark:bg-blue-950/40 rounded-full -z-10"
            initial={false}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
            }}
          />
        )}
        <Icon className="w-5 h-5" />
      </Link>
    );
  };

  return (
    <nav
      aria-label="Navegación móvil"
      className="flex max-w-[calc(100vw-1rem)] items-center gap-1 overflow-x-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/60 dark:border-zinc-800/60 shadow-xl shadow-zinc-200/40 dark:shadow-black/60 rounded-full px-2 py-1.5"
    >
      {/* Left items: Inicio, Movimientos, Recurrentes */}
      {NAV_LEFT.map(renderIconLink)}

      {/* Center item: + Cargar */}
      <Link
        href="/movimientos/nuevo"
        className="mx-1 flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-md shadow-blue-500/25 transition-all"
        aria-label="Cargar movimiento"
      >
        <Plus className="w-5 h-5" />
      </Link>

      {/* Right items: Personas, Medios de pago, Conexiones con IA */}
      {NAV_RIGHT.map(renderIconLink)}
      <SignOutButton compact />
    </nav>
  );
}
