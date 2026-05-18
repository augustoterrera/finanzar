import type { Category, CreditCard, FinancialAccount } from "@/lib/generated/prisma/client";
import type { ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  ChartNoAxesCombined,
  Plus,
  ReceiptText,
  Repeat,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldShell, SelectInput, TextInput } from "@/components/ui/field";
import {
  completeReminderAction,
  createBudgetAction,
  createRecurringRuleAction,
  createReminderAction,
  createSubscriptionAction,
  deleteBudgetAction,
  deleteRecurringRuleAction,
  deleteReminderAction,
  deleteSubscriptionAction,
} from "@/features/planning/actions";
import type {
  BudgetOverview,
  CashflowEvent,
  RecurringRuleOverview,
  ReminderOverview,
  SubscriptionOverview,
} from "@/features/planning/queries";
import { formatCurrency, formatDate } from "@/lib/utils/format";

type PlanningDashboardProps = {
  accounts: FinancialAccount[];
  budgets: BudgetOverview[];
  cards: CreditCard[];
  cashflow: CashflowEvent[];
  categories: Category[];
  reminders: ReminderOverview[];
  recurringRules: RecurringRuleOverview[];
  subscriptions: SubscriptionOverview[];
};

const frequencyLabels: Record<string, string> = {
  BIMONTHLY: "Cada 2 meses",
  BIWEEKLY: "Cada 2 semanas",
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  WEEKLY: "Semanal",
  YEARLY: "Anual",
};

export function PlanningDashboard({
  accounts,
  budgets,
  cards,
  cashflow,
  categories,
  reminders,
  recurringRules,
  subscriptions,
}: PlanningDashboardProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
      <div className="grid content-start gap-4">
        <RecurringRuleCreateCard accounts={accounts} categories={categories} />
        <SubscriptionCreateCard
          accounts={accounts}
          cards={cards}
          categories={categories}
        />
        <BudgetCreateCard categories={categories} />
        <ReminderCreateCard />
      </div>

      <div className="grid content-start gap-4">
        <ExpectedCashflowCard cashflow={cashflow} />
        <RecurringRulesList recurringRules={recurringRules} />
        <SubscriptionsList subscriptions={subscriptions} />
        <BudgetsList budgets={budgets} />
        <RemindersList reminders={reminders} />
      </div>
    </div>
  );
}

function RecurringRuleCreateCard({
  accounts,
  categories,
}: {
  accounts: FinancialAccount[];
  categories: Category[];
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="p-4">
      <form action={createRecurringRuleAction} className="grid gap-3">
        <SectionTitle
          icon={<Repeat aria-hidden="true" size={20} />}
          subtitle="Sueldos, alquileres, servicios y gastos que se repiten."
          title="Movimiento recurrente"
        />

        <div className="grid grid-cols-2 gap-3">
          <FieldShell label="Tipo">
            <SelectInput defaultValue="EXPENSE" name="type" required>
              <option value="EXPENSE">Gasto</option>
              <option value="INCOME">Ingreso</option>
            </SelectInput>
          </FieldShell>

          <FieldShell label="Importe">
            <TextInput
              inputMode="decimal"
              name="amount"
              placeholder="0"
              required
              step="0.01"
              type="number"
            />
          </FieldShell>
        </div>

        <FieldShell label="Descripción">
          <TextInput
            name="description"
            placeholder="Sueldo, alquiler, internet"
            required
            type="text"
          />
        </FieldShell>

        <div className="grid gap-3 min-[420px]:grid-cols-2">
          <FieldShell label="Frecuencia">
            <FrequencySelect />
          </FieldShell>

          <FieldShell label="Próxima fecha">
            <TextInput defaultValue={today} name="startAt" required type="date" />
          </FieldShell>
        </div>

        <div className="grid gap-3 min-[420px]:grid-cols-2">
          <FieldShell label="Cuenta financiera">
            <SelectInput name="accountId">
              <option value="">Sin cuenta fija</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </SelectInput>
          </FieldShell>

          <FieldShell label="Categoría">
            <CategorySelect categories={categories} />
          </FieldShell>
        </div>

        <Button className="w-full" type="submit">
          <Plus aria-hidden="true" size={18} />
          Agregar recurrente
        </Button>
      </form>
    </Card>
  );
}

function SubscriptionCreateCard({
  accounts,
  cards,
  categories,
}: {
  accounts: FinancialAccount[];
  cards: CreditCard[];
  categories: Category[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const expenseCategories = categories.filter((category) =>
    ["EXPENSE", "BOTH"].includes(category.type),
  );

  return (
    <Card className="p-4">
      <form action={createSubscriptionAction} className="grid gap-3">
        <SectionTitle
          icon={<ReceiptText aria-hidden="true" size={20} />}
          subtitle="Servicios y cargos fijos como streaming, software o membresías."
          title="Suscripción"
        />

        <div className="grid gap-3 min-[420px]:grid-cols-2">
          <FieldShell label="Nombre">
            <TextInput name="name" placeholder="Netflix" required type="text" />
          </FieldShell>

          <FieldShell label="Importe">
            <TextInput
              inputMode="decimal"
              name="amount"
              placeholder="0"
              required
              step="0.01"
              type="number"
            />
          </FieldShell>
        </div>

        <div className="grid gap-3 min-[420px]:grid-cols-2">
          <FieldShell label="Proveedor">
            <TextInput name="provider" placeholder="Empresa o servicio" type="text" />
          </FieldShell>

          <FieldShell label="Próximo cobro">
            <TextInput
              defaultValue={today}
              name="nextBillingAt"
              required
              type="date"
            />
          </FieldShell>
        </div>

        <div className="grid gap-3 min-[420px]:grid-cols-2">
          <FieldShell label="Frecuencia">
            <FrequencySelect />
          </FieldShell>

          <FieldShell label="Categoría">
            <CategorySelect categories={expenseCategories} />
          </FieldShell>
        </div>

        <div className="grid gap-3 min-[420px]:grid-cols-2">
          <FieldShell label="Cuenta financiera">
            <SelectInput name="sourceAccountId">
              <option value="">Sin cuenta fija</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </SelectInput>
          </FieldShell>

          <FieldShell label="Tarjeta">
            <SelectInput name="creditCardId">
              <option value="">Sin tarjeta fija</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </SelectInput>
          </FieldShell>
        </div>

        <Button className="w-full" type="submit">
          <Plus aria-hidden="true" size={18} />
          Agregar suscripción
        </Button>
      </form>
    </Card>
  );
}

function BudgetCreateCard({ categories }: { categories: Category[] }) {
  const now = new Date();
  const startsAt = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const endsAt = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  const expenseCategories = categories.filter((category) =>
    ["EXPENSE", "BOTH"].includes(category.type),
  );

  return (
    <Card className="p-4">
      <form action={createBudgetAction} className="grid gap-3">
        <SectionTitle
          icon={<ChartNoAxesCombined aria-hidden="true" size={20} />}
          subtitle="Un tope para seguir gastos durante un período."
          title="Presupuesto"
        />

        <div className="grid gap-3 min-[420px]:grid-cols-2">
          <FieldShell label="Nombre">
            <TextInput name="name" placeholder="Comida del mes" required type="text" />
          </FieldShell>

          <FieldShell label="Importe">
            <TextInput
              inputMode="decimal"
              name="amount"
              placeholder="0"
              required
              step="0.01"
              type="number"
            />
          </FieldShell>
        </div>

        <FieldShell label="Categoría">
          <CategorySelect categories={expenseCategories} />
        </FieldShell>

        <div className="grid grid-cols-2 gap-3">
          <FieldShell label="Desde">
            <TextInput defaultValue={startsAt} name="startsAt" required type="date" />
          </FieldShell>

          <FieldShell label="Hasta">
            <TextInput defaultValue={endsAt} name="endsAt" required type="date" />
          </FieldShell>
        </div>

        <Button className="w-full" type="submit">
          <Plus aria-hidden="true" size={18} />
          Agregar presupuesto
        </Button>
      </form>
    </Card>
  );
}

function ReminderCreateCard() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="p-4">
      <form action={createReminderAction} className="grid gap-3">
        <SectionTitle
          icon={<Bell aria-hidden="true" size={20} />}
          subtitle="Avisos manuales para pagos, trámites o fechas importantes."
          title="Recordatorio"
        />

        <FieldShell label="Título">
          <TextInput name="title" placeholder="Pagar expensas" required type="text" />
        </FieldShell>

        <div className="grid gap-3 min-[420px]:grid-cols-2">
          <FieldShell label="Fecha">
            <TextInput defaultValue={today} name="dueAt" required type="date" />
          </FieldShell>

          <FieldShell label="Detalle">
            <TextInput name="description" placeholder="Opcional" type="text" />
          </FieldShell>
        </div>

        <Button className="w-full" type="submit">
          <Plus aria-hidden="true" size={18} />
          Agregar recordatorio
        </Button>
      </form>
    </Card>
  );
}

function ExpectedCashflowCard({ cashflow }: { cashflow: CashflowEvent[] }) {
  const total = cashflow.reduce((sum, event) => sum + event.amount, 0);

  return (
    <Card className="p-4">
      <SectionTitle
        icon={<CalendarDays aria-hidden="true" size={20} />}
        subtitle="Próximos 60 días con recurrentes, suscripciones y tarjetas."
        title="Flujo esperado"
      />

      <div className="mt-3 rounded-lg bg-surface-muted p-3">
        <p className="text-sm font-semibold text-muted">Resultado esperado</p>
        <p className="mt-1 text-2xl font-bold">{formatCurrency(total)}</p>
      </div>

      {cashflow.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Agregá ingresos, gastos recurrentes o suscripciones para ver el flujo.
        </p>
      ) : (
        <div className="mt-3 grid gap-2">
          {cashflow.slice(0, 10).map((event) => (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3"
              key={event.id}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{event.label}</p>
                <p className="text-sm text-muted">{formatDate(event.date)}</p>
              </div>
              <p
                className={
                  event.amount >= 0
                    ? "shrink-0 font-bold text-emerald-500"
                    : "shrink-0 font-bold text-red-500"
                }
              >
                {formatCurrency(event.amount, event.currency)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RecurringRulesList({
  recurringRules,
}: {
  recurringRules: RecurringRuleOverview[];
}) {
  return (
    <ListSection
      emptyText="No hay ingresos o gastos recurrentes."
      items={recurringRules}
      title="Recurrentes"
    >
      {(rule) => {
        const deleteAction = deleteRecurringRuleAction.bind(null, rule.id);

        return (
          <ListRow
            action={
              <form action={deleteAction}>
                <IconButton label="Eliminar recurrente">
                  <Trash2 aria-hidden="true" size={18} />
                </IconButton>
              </form>
            }
            icon={<Repeat aria-hidden="true" size={18} />}
            key={rule.id}
            meta={[
              frequencyLabels[rule.frequency],
              rule.nextRunAt ? formatDate(rule.nextRunAt) : undefined,
              rule.accountName,
              rule.categoryName,
            ]}
            title={rule.description}
            value={formatCurrency(
              rule.type === "INCOME" ? rule.amount : -rule.amount,
              rule.currency,
            )}
            valueTone={rule.type === "INCOME" ? "income" : "expense"}
          />
        );
      }}
    </ListSection>
  );
}

function SubscriptionsList({
  subscriptions,
}: {
  subscriptions: SubscriptionOverview[];
}) {
  return (
    <ListSection
      emptyText="No hay suscripciones cargadas."
      items={subscriptions}
      title="Suscripciones"
    >
      {(subscription) => {
        const deleteAction = deleteSubscriptionAction.bind(null, subscription.id);

        return (
          <ListRow
            action={
              <form action={deleteAction}>
                <IconButton label="Eliminar suscripción">
                  <Trash2 aria-hidden="true" size={18} />
                </IconButton>
              </form>
            }
            icon={<ReceiptText aria-hidden="true" size={18} />}
            key={subscription.id}
            meta={[
              subscription.provider,
              subscription.nextBillingAt
                ? formatDate(subscription.nextBillingAt)
                : undefined,
              subscription.paymentSource,
              subscription.categoryName,
            ]}
            title={subscription.name}
            value={formatCurrency(-subscription.amount, subscription.currency)}
            valueTone="expense"
          />
        );
      }}
    </ListSection>
  );
}

function BudgetsList({ budgets }: { budgets: BudgetOverview[] }) {
  return (
    <ListSection emptyText="No hay presupuestos activos." items={budgets} title="Presupuestos">
      {(budget) => {
        const deleteAction = deleteBudgetAction.bind(null, budget.id);
        const progress = budget.amount > 0 ? Math.min(budget.spent / budget.amount, 1) : 0;

        return (
          <div
            className="rounded-lg border border-border bg-background p-3"
            key={budget.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{budget.name}</p>
                <p className="text-sm text-muted">
                  {[budget.categoryName, `${formatDate(budget.startsAt)} a ${formatDate(budget.endsAt)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <form action={deleteAction}>
                <IconButton label="Eliminar presupuesto">
                  <Trash2 aria-hidden="true" size={18} />
                </IconButton>
              </form>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-muted">
              Usado {formatCurrency(budget.spent, budget.currency)} de{" "}
              {formatCurrency(budget.amount, budget.currency)}
            </p>
          </div>
        );
      }}
    </ListSection>
  );
}

function RemindersList({ reminders }: { reminders: ReminderOverview[] }) {
  return (
    <ListSection emptyText="No hay recordatorios pendientes." items={reminders} title="Recordatorios">
      {(reminder) => {
        const completeAction = completeReminderAction.bind(null, reminder.id);
        const deleteAction = deleteReminderAction.bind(null, reminder.id);

        return (
          <ListRow
            action={
              <div className="flex gap-2">
                <form action={completeAction}>
                  <IconButton label="Marcar recordatorio como hecho">
                    <Check aria-hidden="true" size={18} />
                  </IconButton>
                </form>
                <form action={deleteAction}>
                  <IconButton label="Eliminar recordatorio">
                    <Trash2 aria-hidden="true" size={18} />
                  </IconButton>
                </form>
              </div>
            }
            icon={<Bell aria-hidden="true" size={18} />}
            key={reminder.id}
            meta={[formatDate(reminder.dueAt), reminder.description]}
            title={reminder.title}
          />
        );
      }}
    </ListSection>
  );
}

function CategorySelect({ categories }: { categories: Category[] }) {
  return (
    <SelectInput name="categoryId">
      <option value="">Sin categoría</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </SelectInput>
  );
}

function FrequencySelect() {
  return (
    <SelectInput defaultValue="MONTHLY" name="frequency" required>
      <option value="WEEKLY">Semanal</option>
      <option value="BIWEEKLY">Cada 2 semanas</option>
      <option value="MONTHLY">Mensual</option>
      <option value="BIMONTHLY">Cada 2 meses</option>
      <option value="QUARTERLY">Trimestral</option>
      <option value="YEARLY">Anual</option>
    </SelectInput>
  );
}

function ListSection<T>({
  children,
  emptyText,
  items,
  title,
}: {
  children: (item: T) => ReactNode;
  emptyText: string;
  items: T[];
  title: string;
}) {
  return (
    <Card className="p-4">
      <h2 className="font-bold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{emptyText}</p>
      ) : (
        <div className="mt-3 grid gap-2">{items.map(children)}</div>
      )}
    </Card>
  );
}

function ListRow({
  action,
  icon,
  meta,
  title,
  value,
  valueTone,
}: {
  action?: ReactNode;
  icon: ReactNode;
  meta: Array<string | undefined>;
  title: string;
  value?: string;
  valueTone?: "income" | "expense";
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{title}</p>
        <p className="text-sm text-muted">
          {meta.filter(Boolean).join(" · ") || "Sin detalle"}
        </p>
      </div>
      {value ? (
        <p
          className={
            valueTone === "income"
              ? "shrink-0 font-bold text-emerald-500"
              : valueTone === "expense"
                ? "shrink-0 font-bold text-red-500"
                : "shrink-0 font-bold"
          }
        >
          {value}
        </p>
      ) : null}
      {action}
    </div>
  );
}

function IconButton({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <Button title={label} type="submit" variant="secondary">
      {children}
    </Button>
  );
}

function SectionTitle({
  icon,
  subtitle,
  title,
}: {
  icon: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
    </div>
  );
}
