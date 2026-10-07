'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, CreditCard, Wallet } from 'lucide-react';
import { formatCents } from '@/lib/format';

export type DebtByCardGroup = {
  id: string;
  name: string;
  color?: string | null;
  isCard: boolean;
  debts: Array<{
    personId: string;
    personName: string;
    amount: number;
  }>;
};

export default function CuentasClarasPorTarjeta({
  groups,
}: {
  groups: DebtByCardGroup[];
}) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  if (groups.length === 0) {
    return (
      <div className="p-10 text-center text-zinc-500">
        <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-green-500/10 text-green-500 flex items-center justify-center border border-green-500/20">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <p className="font-bold text-base text-zinc-800 dark:text-zinc-200">Cuentas saldadas.</p>
        <p className="text-sm mt-1 text-zinc-500 dark:text-zinc-400">Nadie te debe plata este mes.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {groups.map((group) => {
        const isOpen = group.id === openGroupId;
        const total = group.debts.reduce((sum, debt) => sum + debt.amount, 0);

        return (
          <li key={group.id}>
            <button
              type="button"
              onClick={() => setOpenGroupId(isOpen ? null : group.id)}
              aria-expanded={isOpen}
              className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center"
                  style={{
                    backgroundColor: `${group.color ?? '#3b82f6'}1a`,
                    color: group.color ?? '#3b82f6',
                  }}
                >
                  {group.isCard ? <CreditCard className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{group.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {group.isCard ? 'Tarjeta de crédito' : 'Gastos sin tarjeta'} · {group.debts.length} {group.debts.length === 1 ? 'persona' : 'personas'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  {group.debts.length > 0 ? (
                    <p className={`font-bold text-sm ${total >= 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                      {total >= 0 ? `Te deben ${formatCents(total)}` : `Debes ${formatCents(Math.abs(total))}`}
                    </p>
                  ) : (
                    <p className="font-medium text-sm text-zinc-500">Sin saldo pendiente</p>
                  )}
                  <p className="text-[11px] text-zinc-400">Ver detalle</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {isOpen && (
              <ul className="border-t border-zinc-100 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-900/30 divide-y divide-zinc-200 dark:divide-zinc-700">
                {group.debts.map((debt) => (
                  <li key={debt.personId} className="py-3 pl-8 pr-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${debt.amount > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                        {debt.personName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{debt.personName}</p>
                        <p className="text-xs text-zinc-500">{debt.amount > 0 ? 'Le pagaste cosas' : 'Te pagó cosas'}</p>
                      </div>
                    </div>
                    <p className={`font-bold text-sm ${debt.amount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                      {debt.amount > 0 ? `Te debe ${formatCents(debt.amount)}` : `Le debes ${formatCents(Math.abs(debt.amount))}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
