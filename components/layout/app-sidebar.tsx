import Link from "next/link";
import {
  ChartNoAxesCombined,
  CreditCard,
  FolderKanban,
  List,
  Settings,
  Wallet,
} from "lucide-react";

const items = [
  { href: "/dashboard", icon: ChartNoAxesCombined, label: "Inicio" },
  { href: "/accounts", icon: Wallet, label: "Cuentas" },
  { href: "/transactions", icon: List, label: "Movimientos" },
  { href: "/cards", icon: CreditCard, label: "Tarjetas" },
  { href: "/projects", icon: FolderKanban, label: "Proyectos" },
  { href: "/settings", icon: Settings, label: "Ajustes" },
];

type AppSidebarProps = {
  workspaceName: string;
};

export function AppSidebar({ workspaceName }: AppSidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-svh w-64 shrink-0 border-r border-border bg-surface px-4 py-5 md:block">
      <div className="mb-8">
        <p className="text-sm font-semibold text-primary">Finanzar</p>
        <h2 className="mt-1 truncate text-lg font-bold">{workspaceName}</h2>
      </div>
      <nav className="grid gap-1">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground"
              href={item.href}
              key={item.href}
            >
              <Icon aria-hidden="true" size={19} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
