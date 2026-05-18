import type { Category, FinancialAccount } from "@/lib/generated/prisma/client";
import type { ReactNode } from "react";
import {
  Banknote,
  Bell,
  CalendarDays,
  CreditCard,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldShell, SelectInput, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import {
  createCardPaymentAction,
  createCardPurchaseAction,
  createCreditCardAction,
  deleteCardPurchaseAction,
  deleteCreditCardAction,
  updateCreditCardAction,
} from "@/features/cards/actions";
import type {
  CardForecastMonth,
  CardStatementOverview,
  CreditCardOverview,
} from "@/features/cards/queries";
import { formatCurrency, formatDate } from "@/lib/utils/format";

type CardsDashboardProps = {
  accounts: FinancialAccount[];
  cards: CreditCardOverview[];
  categories: Category[];
  forecast: CardForecastMonth[];
};

const networkLabels: Record<string, string> = {
  AMEX: "American Express",
  CABAL: "Cabal",
  MASTERCARD: "Mastercard",
  NARANJA: "Naranja",
  OTHER: "Otra",
  VISA: "Visa",
};

const statusLabels: Record<CardStatementOverview["status"], string> = {
  CLOSED: "Cerrado",
  OPEN: "Abierto",
  OVERDUE: "Vencido",
  PAID: "Pagado",
  PARTIALLY_PAID: "Pago parcial",
};

export function CardsDashboard({
  accounts,
  cards,
  categories,
  forecast,
}: CardsDashboardProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
      <div className="grid content-start gap-4">
        <CreditCardCreateCard accounts={accounts} />
        <CardPurchaseCreateCard cards={cards} categories={categories} />
        <DebtForecastCard forecast={forecast} />
      </div>

      <CreditCardList accounts={accounts} cards={cards} />
    </div>
  );
}

function CreditCardCreateCard({ accounts }: { accounts: FinancialAccount[] }) {
  return (
    <Card className="p-4">
      <form action={createCreditCardAction} className="grid gap-3">
        <SectionTitle
          icon={<CreditCard aria-hidden="true" size={20} />}
          subtitle="Cargá el cierre y vencimiento para generar resúmenes."
          title="Nueva tarjeta de crédito"
        />

        <CreditCardFields accounts={accounts} />

        <Button className="w-full" type="submit">
          <Plus aria-hidden="true" size={18} />
          Agregar tarjeta
        </Button>
      </form>
    </Card>
  );
}

function CardPurchaseCreateCard({
  cards,
  categories,
}: {
  cards: CreditCardOverview[];
  categories: Category[];
}) {
  const today = new Date().toISOString().slice(0, 10);

  if (cards.length === 0) {
    return (
      <Card className="p-4">
        <SectionTitle
          icon={<ReceiptText aria-hidden="true" size={20} />}
          subtitle="Primero agregá una tarjeta para registrar consumos."
          title="Nueva compra"
        />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <form action={createCardPurchaseAction} className="grid gap-3">
        <SectionTitle
          icon={<ReceiptText aria-hidden="true" size={20} />}
          subtitle="Las cuotas se asignan al resumen que corresponde."
          title="Nueva compra"
        />

        <FieldShell label="Tarjeta">
          <SelectInput name="creditCardId" required>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </SelectInput>
        </FieldShell>

        <div className="grid grid-cols-2 gap-3">
          <FieldShell label="Importe">
            <TextInput
              inputMode="decimal"
              name="totalAmount"
              placeholder="0"
              required
              step="0.01"
              type="number"
            />
          </FieldShell>

          <FieldShell label="Cuotas">
            <TextInput
              defaultValue="1"
              inputMode="numeric"
              min="1"
              name="installmentsCount"
              required
              step="1"
              type="number"
            />
          </FieldShell>
        </div>

        <FieldShell label="Descripción">
          <TextInput
            autoComplete="off"
            name="description"
            placeholder="Supermercado"
            required
            type="text"
          />
        </FieldShell>

        <div className="grid gap-3 min-[380px]:grid-cols-2">
          <FieldShell label="Comercio">
            <TextInput
              autoComplete="off"
              name="merchant"
              placeholder="Nombre del lugar"
              type="text"
            />
          </FieldShell>

          <FieldShell label="Fecha de compra">
            <TextInput defaultValue={today} name="purchasedAt" required type="date" />
          </FieldShell>
        </div>

        <FieldShell label="Categoría">
          <SelectInput name="categoryId">
            <option value="">Sin categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectInput>
        </FieldShell>

        <Button className="w-full" type="submit">
          <Plus aria-hidden="true" size={18} />
          Agregar compra
        </Button>
      </form>
    </Card>
  );
}

function CreditCardList({
  accounts,
  cards,
}: {
  accounts: FinancialAccount[];
  cards: CreditCardOverview[];
}) {
  if (cards.length === 0) {
    return (
      <Card>
        <h2 className="font-bold">Todavía no hay tarjetas de crédito</h2>
        <p className="mt-2 text-sm text-muted">
          Agregá una tarjeta para ver cierres, vencimientos y deuda futura.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {cards.map((card) => {
        const updateAction = updateCreditCardAction.bind(null, card.id);
        const deleteAction = deleteCreditCardAction.bind(null, card.id);

        return (
          <Card className="p-4" key={card.id}>
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-primary">
                <CreditCard aria-hidden="true" size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-bold">{card.name}</h2>
                <p className="text-sm text-muted">
                  {[card.issuer, networkLabels[card.network], card.lastFour ? `termina en ${card.lastFour}` : undefined]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Modal
                  title="Editar tarjeta"
                  trigger={
                    <Button title="Editar tarjeta" type="button" variant="secondary">
                      <Pencil aria-hidden="true" size={18} />
                    </Button>
                  }
                >
                  <form action={updateAction} className="grid gap-3">
                    <CreditCardFields accounts={accounts} card={card} />
                    <Button type="submit">Guardar cambios</Button>
                  </form>
                </Modal>
                <form action={deleteAction}>
                  <Button title="Eliminar tarjeta" type="submit" variant="secondary">
                    <Trash2 aria-hidden="true" size={18} />
                  </Button>
                </form>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 min-[520px]:grid-cols-4">
              <Metric
                label="Deuda actual"
                value={formatCurrency(card.currentDebt, card.currency)}
              />
              <Metric
                label="Disponible"
                value={
                  card.availableCredit === undefined
                    ? "Sin límite"
                    : formatCurrency(card.availableCredit, card.currency)
                }
              />
              <Metric label="Cierre" value={`Día ${card.closingDay}`} />
              <Metric label="Vence" value={`Día ${card.dueDay}`} />
            </div>

            {card.nextDueStatement ? (
              <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Bell aria-hidden="true" className="text-secondary-strong" size={17} />
                  Próximo vencimiento: {formatDate(card.nextDueStatement.dueDate)}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatCurrency(card.nextDueStatement.balance, card.currency)} del
                  resumen {card.nextDueStatement.monthLabel}.
                </p>
              </div>
            ) : null}

            <StatementsList accounts={accounts} card={card} />
            <PurchasesList card={card} />
          </Card>
        );
      })}
    </div>
  );
}

function StatementsList({
  accounts,
  card,
}: {
  accounts: FinancialAccount[];
  card: CreditCardOverview;
}) {
  if (card.statements.length === 0) {
    return (
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="font-bold">Resúmenes</h3>
        <p className="mt-1 text-sm text-muted">
          Cuando cargues compras, acá vas a ver los resúmenes mensuales.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <h3 className="font-bold">Resúmenes mensuales</h3>
      <div className="mt-3 grid gap-3">
        {card.statements.map((statement) => (
          <div
            className="rounded-lg border border-border bg-background p-3"
            key={statement.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold capitalize">{statement.monthLabel}</p>
                <p className="text-sm text-muted">
                  Cierra {formatDate(statement.closingDate)} · vence{" "}
                  {formatDate(statement.dueDate)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">
                {statusLabels[statement.status]}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Metric
                label="Total"
                value={formatCurrency(statement.installmentTotal, card.currency)}
              />
              <Metric
                label="Pagado"
                value={formatCurrency(statement.paidTotal, card.currency)}
              />
              <Metric
                label="Saldo"
                value={formatCurrency(statement.balance, card.currency)}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {statement.reminderDueAt ? (
                <span className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-surface-muted px-3 text-sm text-muted">
                  <CalendarDays aria-hidden="true" size={16} />
                  Recordatorio {formatDate(statement.reminderDueAt)}
                </span>
              ) : null}

              {statement.balance > 0 ? (
                <StatementPaymentModal
                  accounts={accounts}
                  card={card}
                  statement={statement}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatementPaymentModal({
  accounts,
  card,
  statement,
}: {
  accounts: FinancialAccount[];
  card: CreditCardOverview;
  statement: CardStatementOverview;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal
      title="Registrar pago"
      trigger={
        <Button title="Registrar pago del resumen" type="button" variant="secondary">
          <Banknote aria-hidden="true" size={18} />
          Pagar
        </Button>
      }
    >
      {accounts.length === 0 ? (
        <p className="text-sm text-muted">
          Agregá una cuenta financiera para registrar desde dónde salió el pago.
        </p>
      ) : (
        <form action={createCardPaymentAction} className="grid gap-3">
          <input name="creditCardId" type="hidden" value={card.id} />
          <input name="statementId" type="hidden" value={statement.id} />

          <FieldShell label="Cuenta financiera">
            <SelectInput
              defaultValue={card.paymentAccountId ?? accounts[0]?.id}
              name="accountId"
              required
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </SelectInput>
          </FieldShell>

          <div className="grid grid-cols-2 gap-3">
            <FieldShell label="Importe">
              <TextInput
                defaultValue={statement.balance.toFixed(2)}
                inputMode="decimal"
                name="amount"
                required
                step="0.01"
                type="number"
              />
            </FieldShell>

            <FieldShell label="Fecha">
              <TextInput defaultValue={today} name="paidAt" required type="date" />
            </FieldShell>
          </div>

          <FieldShell label="Nota">
            <TextInput
              name="notes"
              placeholder="Pago total, mínimo o parcial"
              type="text"
            />
          </FieldShell>

          <Button type="submit">Registrar pago</Button>
        </form>
      )}
    </Modal>
  );
}

function PurchasesList({ card }: { card: CreditCardOverview }) {
  if (card.purchases.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <h3 className="font-bold">Últimas compras</h3>
      <div className="mt-3 grid gap-2">
        {card.purchases.map((purchase) => {
          const deleteAction = deleteCardPurchaseAction.bind(null, purchase.id);

          return (
            <div
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
              key={purchase.id}
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-primary">
                <ReceiptText aria-hidden="true" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{purchase.description}</p>
                <p className="text-sm text-muted">
                  {formatDate(purchase.purchasedAt)}
                  {purchase.merchant ? ` · ${purchase.merchant}` : ""}
                  {purchase.categoryName ? ` · ${purchase.categoryName}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold">
                  {formatCurrency(purchase.totalAmount, card.currency)}
                </p>
                <p className="text-sm text-muted">{purchase.installmentsCount} cuota(s)</p>
              </div>
              <form action={deleteAction}>
                <Button title="Eliminar compra" type="submit" variant="secondary">
                  <Trash2 aria-hidden="true" size={18} />
                </Button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CreditCardFields({
  accounts,
  card,
}: {
  accounts: FinancialAccount[];
  card?: CreditCardOverview;
}) {
  return (
    <>
      <FieldShell label="Nombre">
        <TextInput
          autoComplete="off"
          defaultValue={card?.name}
          name="name"
          placeholder="Visa banco"
          required
          type="text"
        />
      </FieldShell>

      <div className="grid gap-3 min-[420px]:grid-cols-2">
        <FieldShell label="Entidad">
          <TextInput
            autoComplete="off"
            defaultValue={card?.issuer}
            name="issuer"
            placeholder="Banco o emisor"
            type="text"
          />
        </FieldShell>

        <FieldShell label="Marca">
          <SelectInput defaultValue={card?.network ?? "VISA"} name="network" required>
            <option value="VISA">Visa</option>
            <option value="MASTERCARD">Mastercard</option>
            <option value="AMEX">American Express</option>
            <option value="CABAL">Cabal</option>
            <option value="NARANJA">Naranja</option>
            <option value="OTHER">Otra</option>
          </SelectInput>
        </FieldShell>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldShell label="Últimos 4 números">
          <TextInput
            defaultValue={card?.lastFour}
            inputMode="numeric"
            maxLength={4}
            name="lastFour"
            placeholder="1234"
            type="text"
          />
        </FieldShell>

        <FieldShell label="Moneda">
          <TextInput
            defaultValue={card?.currency ?? "ARS"}
            maxLength={3}
            name="currency"
            required
            type="text"
          />
        </FieldShell>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <FieldShell label="Límite">
          <TextInput
            defaultValue={card?.creditLimit?.toString()}
            inputMode="decimal"
            name="creditLimit"
            placeholder="Opcional"
            step="0.01"
            type="number"
          />
        </FieldShell>

        <FieldShell label="Cierre">
          <TextInput
            defaultValue={card?.closingDay ?? 25}
            inputMode="numeric"
            max="31"
            min="1"
            name="closingDay"
            required
            step="1"
            type="number"
          />
        </FieldShell>

        <FieldShell label="Vence">
          <TextInput
            defaultValue={card?.dueDay ?? 10}
            inputMode="numeric"
            max="31"
            min="1"
            name="dueDay"
            required
            step="1"
            type="number"
          />
        </FieldShell>
      </div>

      <FieldShell label="Cuenta para pagar">
        <SelectInput defaultValue={card?.paymentAccountId ?? ""} name="paymentAccountId">
          <option value="">Sin cuenta fija</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </SelectInput>
      </FieldShell>
    </>
  );
}

function DebtForecastCard({ forecast }: { forecast: CardForecastMonth[] }) {
  return (
    <Card className="p-4">
      <SectionTitle
        icon={<TrendingUp aria-hidden="true" size={20} />}
        subtitle="Suma los saldos pendientes de cada resumen."
        title="Proyección de deuda"
      />

      {forecast.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Cargá compras con tarjeta para ver cuánto vence en los próximos meses.
        </p>
      ) : (
        <div className="mt-3 grid gap-2">
          {forecast.slice(0, 8).map((month) => (
            <div
              className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2"
              key={`${month.year}-${month.month}`}
            >
              <span className="text-sm font-semibold capitalize">{month.label}</span>
              <span className="text-sm font-bold">{formatCurrency(month.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-muted p-3">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="mt-1 truncate font-bold">{value}</p>
    </div>
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
