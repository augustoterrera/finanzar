import { ChevronDown, Plus } from 'lucide-react';
import { formatCents } from '@/lib/format';
import type { ExpenseLedger } from '@/lib/expense-ledgers';

export default function ExpenseLedgerCard({ ledger }: { ledger: ExpenseLedger }) {
  return (
    <details className="group min-w-0 rounded-2xl border border-zinc-200 bg-zinc-50/70 dark:border-zinc-700 dark:bg-zinc-800/70">
      <summary aria-label={`${ledger.personName} · ${ledger.cardName} · ${formatCents(ledger.total)}`} className="grid min-h-20 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl px-4 py-4 hover:bg-zinc-100/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 sm:px-5 dark:hover:bg-zinc-700/40 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ledger.cardColor ?? '#71717a' }} />
            <span className="break-words">{ledger.cardName}</span>
          </h3>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {ledger.items.length} {ledger.items.length === 1 ? 'gasto' : 'gastos'}
            <span aria-hidden="true"> · </span>
            <span className="group-open:hidden">Ver suma</span>
            <span className="hidden group-open:inline">Ocultar suma</span>
          </p>
        </div>
        <span className="whitespace-nowrap text-base font-semibold tabular-nums text-zinc-900 sm:text-lg dark:text-zinc-100">{formatCents(ledger.total)}</span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 text-zinc-500 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none dark:text-zinc-400" />
      </summary>

      <ul className="px-5 sm:px-6">
        {ledger.items.map((item) => (
          <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 border-t border-zinc-200/70 py-3 dark:border-zinc-700/70">
            <div className="min-w-0">
              <p className="break-words text-sm leading-5 text-zinc-700 dark:text-zinc-200">{item.description.trim() || 'Gasto sin descripción'}</p>
              {item.shared && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Parte de un gasto compartido</p>}
            </div>
            <p className="flex items-center gap-1.5 whitespace-nowrap text-sm font-medium tabular-nums text-zinc-800 dark:text-zinc-100">
              <Plus aria-hidden="true" className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500" />
              {formatCents(item.amount)}
            </p>
          </li>
        ))}
      </ul>

      <footer className="mx-5 mb-5 mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t-2 border-zinc-400 pt-4 sm:mx-6 sm:mb-6 dark:border-zinc-500">
        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Total</p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-100">{formatCents(ledger.total)}</p>
      </footer>
    </details>
  );
}
