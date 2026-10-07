import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { cards, people, transaction_splits, transactions } from '@/db/schema';
import MonthSelector from '@/components/MonthSelector';
import ExpenseLedgerCard from '@/components/ExpenseLedgerCard';
import { buildExpenseLedgers, type ExpenseLedger } from '@/lib/expense-ledgers';
import { formatCents } from '@/lib/format';

function isValidMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const month = params.month && isValidMonth(params.month) ? params.month : currentMonth;

  const [allPeople, allCards, txRows] = await Promise.all([
    db.select().from(people),
    db.select().from(cards),
    db
      .select({ tx: transactions, split: transaction_splits })
      .from(transactions)
      .leftJoin(transaction_splits, eq(transactions.id, transaction_splits.transaction_id))
      .where(and(eq(transactions.month, month), eq(transactions.status, 'active'))),
  ]);

  const owner = allPeople.find((person) => person.is_owner);

  if (!owner) {
    return (
      <section className="max-w-5xl mx-auto">
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700">
          No se encontró la persona titular de la cuenta.
        </div>
      </section>
    );
  }

  const transactionsById = new Map<string, typeof transactions.$inferSelect>();
  const splits: typeof transaction_splits.$inferSelect[] = [];

  for (const row of txRows) {
    transactionsById.set(row.tx.id, row.tx);
    if (row.split) splits.push(row.split);
  }

  const monthTransactions = Array.from(transactionsById.values());
  const income = monthTransactions.reduce((total, transaction) =>
    total + (transaction.type === 'income' ? transaction.amount : 0), 0);
  const expenseIds = new Set(monthTransactions.filter((transaction) => transaction.type === 'expense').map((transaction) => transaction.id));
  const ownerExpenses = splits.reduce((total, split) =>
    total + (split.person_id === owner.id && expenseIds.has(split.transaction_id) ? split.amount : 0), 0);
  const ledgers = buildExpenseLedgers(monthTransactions, splits, allPeople, allCards);
  const accountsByPerson = new Map<string, { name: string; isOwner: boolean; total: number; ledgers: ExpenseLedger[] }>();
  for (const ledger of ledgers) {
    const personKey = ledger.personId ?? 'unassigned';
    const account = accountsByPerson.get(personKey) ?? { name: ledger.personName, isOwner: ledger.isOwner, total: 0, ledgers: [] };
    account.total += ledger.total;
    account.ledgers.push(ledger);
    accountsByPerson.set(personKey, account);
  }

  return (
    <section className="max-w-5xl mx-auto space-y-6 selection:bg-blue-100 selection:text-blue-950 dark:selection:bg-blue-900 dark:selection:text-blue-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tus cuentas del mes</h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">Cada gasto, separado por responsable y tarjeta.</p>
        </div>
        <MonthSelector currentMonth={month} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard label="Ingresos" amount={income} icon={<ArrowDownLeft className="w-4 h-4" />} tone="green" />
        <SummaryCard label="Gastos propios" amount={ownerExpenses} icon={<ArrowUpRight className="w-4 h-4" />} tone="red" />
        <SummaryCard label="Disponible" amount={income - ownerExpenses} icon={<Wallet className="w-4 h-4" />} tone="blue" />
      </div>

      {ledgers.length > 0 ? (
        <div className="space-y-5 pt-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Tocá una tarjeta para ver la suma. Los gastos compartidos muestran solo la parte de cada persona.</p>
          <div className="grid grid-cols-1 items-start gap-x-6 gap-y-8 md:grid-cols-2">
            {Array.from(accountsByPerson.entries())
              .sort(([, a], [, b]) =>
                b.ledgers.length - a.ledgers.length
                || Number(b.isOwner) - Number(a.isOwner)
                || a.name.localeCompare(b.name, 'es'),
              )
              .map(([personKey, account]) => (
              <section key={personKey} aria-labelledby={`account-${personKey}`} className="min-w-0 space-y-3">
                <header className="flex items-center justify-between gap-4 px-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 id={`account-${personKey}`} className="break-words text-lg font-semibold tracking-tight">{account.name}</h2>
                    {account.isOwner && <span className="rounded-md bg-zinc-200/70 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">Vos</span>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">Total del mes</p>
                    <p className="mt-0.5 text-base font-semibold tabular-nums">{formatCents(account.total)}</p>
                  </div>
                </header>
                <div className="space-y-3">
                  {account.ledgers.map((ledger) => <ExpenseLedgerCard key={`${month}-${ledger.id}`} ledger={ledger} />)}
                </div>
              </section>
              ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <h2 className="text-lg font-semibold">Este mes todavía no tiene gastos</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Cuando cargues uno, aparecerá en la cuenta de su responsable y tarjeta.</p>
          <Link href="/movimientos/nuevo" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">Cargar gasto</Link>
        </div>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  amount,
  icon,
  tone,
}: {
  label: string;
  amount: number;
  icon: React.ReactNode;
  tone: 'green' | 'red' | 'blue';
}) {
  const tones = {
    green: 'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  };

  return (
    <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center justify-between"><span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</span><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone]}`}>{icon}</div></div>
      <p className="text-2xl lg:text-3xl font-bold mt-3 tabular-nums">{formatCents(amount)}</p>
    </div>
  );
}
