import Image from "next/image";
import { ThemeToggle } from "./theme-toggle";

export default function Home() {
  const palette = [
    {
      name: "Celeste patrio",
      role: "Acciones principales",
      hex: "#378ADD",
      className: "bg-[#378ADD]",
    },
    {
      name: "Azul noche",
      role: "Estados activos",
      hex: "#185FA5",
      className: "bg-[#185FA5]",
    },
    {
      name: "Sol de mayo",
      role: "Acentos y alertas suaves",
      hex: "#EF9F27",
      className: "bg-[#EF9F27]",
    },
    {
      name: "Tierra andina",
      role: "Énfasis secundario",
      hex: "#BA7517",
      className: "bg-[#BA7517]",
    },
    {
      name: "Hueso neutro",
      role: "Fondos de apoyo",
      hex: "#F1EFE8",
      className: "bg-[#F1EFE8]",
    },
  ];

  const movements = [
    { label: "Ingresos", amount: "$ 840.000", tone: "text-primary" },
    { label: "Gastos", amount: "$ 312.500", tone: "text-secondary-strong" },
    { label: "Ahorro", amount: "$ 188.400", tone: "text-secondary" },
  ];

  return (
    <main className="min-h-screen px-5 py-6 text-foreground sm:px-8 lg:px-12">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Image
                alt="Finanzar"
                className="h-auto w-44 sm:w-52"
                height={400}
                priority
                src="/logo.svg"
                width={1200}
              />
              <span className="w-fit rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#111827]">
                Finanzas personales
              </span>
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold leading-tight text-foreground sm:text-5xl">
                Sistema visual con temas y paleta aplicada.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">
                Probá el modo claro, oscuro o automático y revisá cómo funcionan
                los colores en botones, labels, tarjetas y estados.
              </p>
            </div>
          </div>

          <ThemeToggle />
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-muted">
                  Balance disponible
                </p>
                <p className="mt-2 text-4xl font-bold text-foreground">
                  $ 1.247.900
                </p>
              </div>
              <span className="w-fit rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-primary">
                +12,8% este mes
              </span>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {movements.map((item) => (
                <article
                  className="rounded-lg border border-border bg-surface-muted p-4"
                  key={item.label}
                >
                  <p className="text-sm font-medium text-muted">
                    {item.label}
                  </p>
                  <p className={`mt-2 text-2xl font-bold ${item.tone}`}>
                    {item.amount}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button className="rounded-lg bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-primary-strong">
                Agregar ingreso
              </button>
              <button className="rounded-lg bg-secondary px-5 py-3 text-sm font-bold text-[#111827] shadow-sm transition hover:bg-secondary-strong hover:text-white">
                Registrar gasto
              </button>
              <button className="rounded-lg border border-border bg-surface px-5 py-3 text-sm font-bold text-foreground transition hover:bg-surface-muted">
                Ver reporte
              </button>
            </div>
          </section>

          <aside className="rounded-lg border border-border bg-surface-muted p-5 shadow-[var(--shadow)] sm:p-6">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-secondary-strong">
              Presupuesto
            </p>
            <h2 className="mt-3 text-2xl font-bold text-foreground">
              Mayo 2026
            </h2>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-border">
              <div className="h-full w-[68%] rounded-full bg-primary" />
            </div>
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="font-semibold text-muted">Usado</span>
              <span className="font-bold text-foreground">68%</span>
            </div>
            <div className="mt-6 rounded-lg bg-secondary/20 p-4">
              <p className="text-sm font-semibold text-secondary-strong">
                Te quedan $ 147.000 para gastos variables.
              </p>
            </div>
          </aside>
        </div>

        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">
                Paleta
              </p>
              <h2 className="mt-2 text-2xl font-bold text-foreground">
                Colores definidos
              </h2>
            </div>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-sm font-semibold text-muted">
              Fondo oscuro: #0F1923
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {palette.map((color) => (
              <article
                className="rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow)]"
                key={color.hex}
              >
                <span
                  aria-hidden="true"
                  className={`block h-12 w-12 rounded-full border border-border ${color.className}`}
                />
                <h3 className="mt-4 text-sm font-bold text-foreground">
                  {color.name}
                </h3>
                <p className="mt-1 text-sm text-muted">{color.role}</p>
                <p className="mt-3 font-mono text-sm text-muted">
                  {color.hex}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
