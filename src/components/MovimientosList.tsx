'use client';

import { useTransition, useMemo } from 'react';
import Link from 'next/link';
import { Trash2, ArrowDownLeft, ArrowUpRight, CreditCard, Wallet, ArrowRight } from 'lucide-react';
import { formatCents } from '@/lib/format';
import { deleteTransactionAction } from '@/app/movimientos/actions';
import { cn } from '@/lib/utils';

export interface MovementItem {
  id: string;
  date: string;
  month: string;
  type: 'income' | 'expense';
  amount: number; // in cents
  description: string;
  payerName?: string;
  isOwnerPayer: boolean;
  methodName?: string;
  methodColor?: string | null;
  cardName?: string;
  cardColor?: string | null;
  responsibleNames?: string[];
  responsibleSplits?: Array<{ name: string; amount: number }>;
  hasSplits?: boolean;
}

function formatDayHeader(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;

  const [y, m, d] = parts;
  const dateObj = new Date(y, m - 1, d);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (dateStr === todayStr) {
    return 'Hoy';
  }
  if (dateStr === yesterdayStr) {
    return 'Ayer';
  }

  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  
  const weekday = weekdays[dateObj.getDay()] || '';
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const monthName = months[m - 1] || '';

  return `${capitalizedWeekday}, ${d} ${monthName}`;
}

export default function MovimientosList({
  items,
  emptyMessage = 'No hay movimientos en este período.',
  compact = false,
  groupByDate = true,
  maxItems,
  showViewAllLink,
}: {
  items: MovementItem[];
  emptyMessage?: string;
  compact?: boolean;
  groupByDate?: boolean;
  maxItems?: number;
  showViewAllLink?: string;
}) {
  const [isPending, startTransition] = useTransition();

  const displayedItems = useMemo(() => {
    if (maxItems && items.length > maxItems) {
      return items.slice(0, maxItems);
    }
    return items;
  }, [items, maxItems]);

  const grouped = useMemo(() => {
    if (!groupByDate) return null;

    const groups: { date: string; label: string; items: MovementItem[] }[] = [];
    const map = new Map<string, MovementItem[]>();

    for (const item of displayedItems) {
      const list = map.get(item.date);
      if (list) {
        list.push(item);
      } else {
        const newList = [item];
        map.set(item.date, newList);
        groups.push({
          date: item.date,
          label: formatDayHeader(item.date),
          items: newList,
        });
      }
    }
    return groups;
  }, [displayedItems, groupByDate]);

  const handleDelete = (id: string, desc: string) => {
    if (!confirm(`¿Eliminar el movimiento "${desc}"?`)) return;
    startTransition(async () => {
      await deleteTransactionAction(id);
    });
  };

  if (items.length === 0) {
    return (
      <div className="p-10 text-center text-zinc-500 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/70 dark:border-zinc-800/70 shadow-sm">
        <p className="font-semibold text-base">{emptyMessage}</p>
      </div>
    );
  }

  const renderItemRow = (item: MovementItem) => {
    const isIncome = item.type === 'income';
    const badgeColor = item.cardColor || item.methodColor || '#3b82f6';

    return (
      <li
        key={item.id}
        className={cn(
          "group flex items-center justify-between gap-3 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors",
          compact ? "p-3" : "p-4"
        )}
      >
        {/* Left: Icon & Description & Tags */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div
            className={cn(
              "w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center transition-transform group-hover:scale-105",
              isIncome
                ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60"
            )}
          >
            {isIncome ? (
              <ArrowDownLeft className="w-5 h-5" />
            ) : (
              <ArrowUpRight className="w-5 h-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 truncate">
                {item.description}
              </p>
              {item.hasSplits && (
                <span className="text-[11px] bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-semibold px-2 py-0.5 rounded-full border border-purple-200/50 dark:border-purple-800/40">
                  Dividido
                </span>
              )}
              {!item.isOwnerPayer && item.payerName && (
                <span className="text-[11px] bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 font-semibold px-2 py-0.5 rounded-full border border-orange-200/50 dark:border-orange-800/40">
                  Pagó {item.payerName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
              {!groupByDate && (
                <>
                  <span>{formatDayHeader(item.date)}</span>
                  <span>•</span>
                </>
              )}
              {(item.cardName || item.methodName) && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 font-medium text-zinc-700 dark:text-zinc-300">
                  <span
                    className="w-2 h-2 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: badgeColor }}
                  />
                  {item.cardName ? (
                    <span className="inline-flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-zinc-400" />
                      {item.cardName}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Wallet className="w-3 h-3 text-zinc-400" />
                      {item.methodName}
                    </span>
                  )}
                </span>
              )}
              {item.responsibleNames && item.responsibleNames.length > 0 && (
                <span className="text-zinc-500 dark:text-zinc-400">
                  A cargo de {item.responsibleNames.join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Amount & Delete Button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span
              className={cn(
                "font-extrabold text-sm sm:text-base tabular-nums block",
                isIncome
                  ? "text-green-600 dark:text-green-400"
                  : "text-zinc-900 dark:text-zinc-100"
              )}
            >
              {isIncome ? `+ ${formatCents(item.amount)}` : `- ${formatCents(item.amount)}`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleDelete(item.id, item.description)}
            disabled={isPending}
            title="Eliminar movimiento"
            className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200/70 dark:border-zinc-800/70 overflow-hidden">
      {grouped ? (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {grouped.map((group) => (
            <div key={group.date}>
              {/* Day Header */}
              <div className="px-4 py-2 bg-zinc-50/70 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  {group.label}
                </span>
                <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                  {group.items.length} {group.items.length === 1 ? 'movimiento' : 'movimientos'}
                </span>
              </div>
              {/* Items for this day */}
              <ul className="divide-y divide-zinc-100/80 dark:divide-zinc-800/60">
                {group.items.map(renderItemRow)}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {displayedItems.map(renderItemRow)}
        </ul>
      )}

      {/* View All Footer link if maxItems was set */}
      {showViewAllLink && maxItems && items.length > maxItems && (
        <div className="p-3.5 text-center border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
          <Link
            href={showViewAllLink}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <span>Ver todos los movimientos del mes ({items.length - maxItems} más)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
