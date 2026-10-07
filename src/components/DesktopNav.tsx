"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { SignOutButton } from "@/components/SignOutButton";

const NAV_LEFT = [
  { href: "/", label: "Inicio" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/recurrentes", label: "Recurrentes" },
];

const NAV_RIGHT = [
  { href: "/personas", label: "Personas" },
  { href: "/tarjetas", label: "Tarjetas" },
  { href: "/medios-de-pago", label: "Medios" },
];

export function DesktopNav() {
  const pathname = usePathname();
  if (pathname.startsWith('/login')) return null;

  const renderLink = (item: { href: string; label: string }) => {
    const isActive = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "relative px-4 py-2 text-sm font-semibold transition-colors rounded-full",
          isActive
            ? "text-zinc-900 dark:text-white"
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
        )}
      >
        {isActive && (
          <motion.div
            layoutId="desktop-nav-active"
            className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 rounded-full -z-10"
            initial={false}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
            }}
          />
        )}
        <span className="relative z-10">{item.label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Navegación principal"
      className="hidden md:flex items-center gap-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 shadow-lg shadow-zinc-200/20 dark:shadow-black/40 rounded-full px-2 py-2"
    >
      {/* Left Links */}
      {NAV_LEFT.map(renderLink)}

      {/* Cargar Button in the Center */}
      <Link
        href="/movimientos/nuevo"
        className="mx-2 group rounded-full bg-blue-600 text-white transition-all ease-in hover:cursor-pointer hover:bg-blue-700 shadow-sm"
      >
        <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-2 transition ease-out hover:duration-300 text-sm font-bold text-white dark:text-white">
          <Plus className="w-4 h-4 mr-1 transition-transform group-hover:scale-110" />
        </AnimatedShinyText>
      </Link>

      {/* Right Links */}
      {NAV_RIGHT.map(renderLink)}
      <SignOutButton />
    </nav>
  );
}
