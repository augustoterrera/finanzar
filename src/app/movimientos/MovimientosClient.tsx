'use client';

import { useState, useMemo, useTransition, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  X,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import MovimientosList, { MovementItem } from '@/components/MovimientosList';
import { formatCents } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  initialItems: MovementItem[];
  availableMonths: string[];
  defaultMonth?: string;
  currentMonth: string;
}

const ITEMS_PER_PAGE = 15;

export default function MovimientosClient({
  initialItems,
  availableMonths,
  defaultMonth = '',
  currentMonth,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth || currentMonth);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedCard, setSelectedCard] = useState<string>('all');
  const [selectedResponsible, setSelectedResponsible] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const listContainerRef = useRef<HTMLDivElement>(null);

  // Sincronizar selectedMonth cuando el servidor actualiza defaultMonth
  useEffect(() => {
    if (defaultMonth) {
      setSelectedMonth(defaultMonth);
    }
  }, [defaultMonth]);

  // Reiniciar a página 1 cuando cambia cualquier filtro o mes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, selectedCard, selectedResponsible, selectedMonth]);

  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    startTransition(() => {
      if (newMonth === 'all') {
        router.push('/movimientos?month=all');
      } else if (newMonth === currentMonth) {
        router.push('/movimientos');
      } else {
        router.push(`/movimientos?month=${newMonth}`);
      }
    });
  };

  const { availableCards, availableResponsibles, hasNonCardMovements } = useMemo(() => {
    const cards = new Set<string>();
    const responsibles = new Set<string>();
    let hasNonCard = false;

    for (const item of initialItems) {
      if (item.cardName) cards.add(item.cardName);
      else hasNonCard = true;
      item.responsibleNames?.forEach((name) => responsibles.add(name));
    }

    return {
      availableCards: Array.from(cards).sort((a, b) => a.localeCompare(b)),
      availableResponsibles: Array.from(responsibles).sort((a, b) => a.localeCompare(b)),
      hasNonCardMovements: hasNonCard,
    };
  }, [initialItems]);

  const hasActiveFilters =
    selectedMonth !== currentMonth ||
    filterType !== 'all' ||
    selectedCard !== 'all' ||
    selectedResponsible !== 'all' ||
    searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setFilterType('all');
    setSelectedCard('all');
    setSelectedResponsible('all');
    setSearchQuery('');
    setCurrentPage(1);
    if (selectedMonth !== currentMonth) {
      handleMonthChange(currentMonth);
    }
  };

  const filteredItems = useMemo(() => {
    return initialItems
      .filter((item) => {
        // Filtro por mes (si no se eligió 'all')
        if (selectedMonth && selectedMonth !== 'all' && item.month !== selectedMonth) {
          return false;
        }
        // Filtro por tipo
        if (filterType !== 'all' && item.type !== filterType) {
          return false;
        }
        // Filtro por tarjeta
        if (selectedCard === 'without-card' && item.cardName) {
          return false;
        }
        if (selectedCard !== 'all' && selectedCard !== 'without-card' && item.cardName !== selectedCard) {
          return false;
        }
        // Filtro por responsable
        if (selectedResponsible !== 'all' && !item.responsibleNames?.includes(selectedResponsible)) {
          return false;
        }
        // Búsqueda
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchDesc = item.description.toLowerCase().includes(q);
          const matchPayer = item.payerName ? item.payerName.toLowerCase().includes(q) : false;
          const matchMethod = item.methodName ? item.methodName.toLowerCase().includes(q) : false;
          const matchCard = item.cardName ? item.cardName.toLowerCase().includes(q) : false;
          const matchResponsible = item.responsibleNames?.some((name) => name.toLowerCase().includes(q)) ?? false;
          
          // Limpiamos los formatos para comparar los números directamente
          const qNumeric = q.replace(/[^0-9]/g, '');
          const amountFullStr = String(item.amount); // centavos
          const amountWholeStr = String(Math.floor(item.amount / 100)); // pesos
          
          const matchAmount = 
            (qNumeric.length > 0 && (amountFullStr.includes(qNumeric) || amountWholeStr.includes(qNumeric))) || 
            formatCents(item.amount).toLowerCase().includes(q);
          
          if (!matchDesc && !matchPayer && !matchMethod && !matchCard && !matchResponsible && !matchAmount) {
            return false;
          }
        }
        return true;
      })
      .map((item) => {
        if (selectedResponsible === 'all') return item;

        const responsibleSplit = item.responsibleSplits?.find(
          (split) => split.name === selectedResponsible
        );

        return responsibleSplit ? { ...item, amount: responsibleSplit.amount } : item;
      });
  }, [initialItems, selectedMonth, filterType, selectedCard, selectedResponsible, searchQuery]);

  // Métricas del conjunto filtrado actual
  const { totalIncome, totalExpense, balance } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const item of filteredItems) {
      if (item.type === 'income') {
        income += item.amount;
      } else {
        expense += item.amount;
      }
    }
    return {
      totalIncome: income,
      totalExpense: expense,
      balance: income - expense,
    };
  }, [filteredItems]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredItems.length);

  const paginatedItems = useMemo(() => {
    return filteredItems.slice(startIndex, endIndex);
  }, [filteredItems, startIndex, endIndex]);

  const goToPage = (page: number) => {
    const target = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(target);
    if (listContainerRef.current) {
      listContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (safeCurrentPage <= 4) {
      pages.push(1, 2, 3, 4, 5, '...', totalPages);
    } else if (safeCurrentPage >= totalPages - 3) {
      pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages);
    }
    return pages;
  }, [totalPages, safeCurrentPage]);

  const formatMonthLabel = (m: string) => {
    if (!m || m === 'all') return 'Todos los meses';
    const [year, month] = m.split('-');
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const monthName = months[parseInt(month, 10) - 1] || month;
    return `${monthName} ${year}`;
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Movimientos
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            {selectedMonth === 'all'
              ? 'Historial completo de todos los movimientos registrados.'
              : `Mostrando movimientos de ${formatMonthLabel(selectedMonth)}.`}
          </p>
        </div>

        <Link
          href="/movimientos/nuevo"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all shadow-sm hover:shadow inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Cargar movimiento
        </Link>
      </div>

      {/* Summary Cards of Filtered */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200/70 dark:border-zinc-800/70 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Total Ingresos</span>
            <div className="w-9 h-9 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-extrabold tracking-tight text-green-600 dark:text-green-400 mt-4">
            {formatCents(totalIncome)}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200/70 dark:border-zinc-800/70 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Total Egresos</span>
            <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-extrabold tracking-tight text-red-600 dark:text-red-400 mt-4">
            {formatCents(totalExpense)}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200/70 dark:border-zinc-800/70 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Balance Neto</span>
            <div
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center border',
                balance >= 0
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                  : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
              )}
            >
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p
            className={cn(
              'text-2xl lg:text-3xl font-extrabold tracking-tight mt-4',
              balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'
            )}
          >
            {formatCents(balance)}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-sm border border-zinc-200/70 dark:border-zinc-800/70 space-y-4">
        {/* Row 1: Search & Month */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por descripción, importe, persona o medio..."
              className="w-full pl-10 pr-9 py-2.5 text-sm bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 rounded-2xl focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 rounded-full"
                title="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Month Selector */}
          <div className="relative w-full sm:w-64">
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              disabled={isPending}
              aria-label="Filtrar por mes"
              className="w-full px-3.5 py-2.5 text-sm font-medium bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 rounded-2xl focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-60"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                  {m === currentMonth ? ' (Mes actual)' : ''}
                </option>
              ))}
              <option value="all">Todos los meses (Historial completo)</option>
            </select>
            {isPending && (
              <div className="absolute right-9 top-3 pointer-events-none">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Card & Responsible Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={selectedCard}
            onChange={(e) => setSelectedCard(e.target.value)}
            aria-label="Filtrar por tarjeta"
            className="w-full px-3.5 py-2.5 text-sm font-medium bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 rounded-2xl focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          >
            <option value="all">Todas las tarjetas</option>
            {availableCards.map((card) => (
              <option key={card} value={card}>
                {card}
              </option>
            ))}
            {hasNonCardMovements && <option value="without-card">Sin tarjeta (efectivo/billetera)</option>}
          </select>

          <select
            value={selectedResponsible}
            onChange={(e) => setSelectedResponsible(e.target.value)}
            aria-label="Filtrar por responsable"
            className="w-full px-3.5 py-2.5 text-sm font-medium bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 rounded-2xl focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          >
            <option value="all">Todos los responsables</option>
            {availableResponsibles.map((person) => (
              <option key={person} value={person}>
                {person}
              </option>
            ))}
          </select>
        </div>

        {/* Row 3: Segmented Type Switcher & Results / Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          {/* Animated Segmented Tabs */}
          <div className="relative flex p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 w-full sm:w-auto">
            {(
              [
                { id: 'all', label: `Todos (${initialItems.length})` },
                { id: 'income', label: 'Ingresos' },
                { id: 'expense', label: 'Egresos' },
              ] as const
            ).map((tab) => {
              const isActive = filterType === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterType(tab.id)}
                  className={cn(
                    'relative flex-1 sm:flex-initial px-3 py-1.5 font-bold transition-colors rounded-lg z-10',
                    isActive
                      ? 'text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="movimientos-filter-type"
                      className="absolute inset-0 bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200/60 dark:border-zinc-700/60 -z-10"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline px-1 py-0.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </button>
            )}

            <span className="text-zinc-400 dark:text-zinc-500 font-semibold">
              {filteredItems.length} resultado{filteredItems.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Movements List Container with Pagination */}
      <div
        ref={listContainerRef}
        className={cn('space-y-6 transition-opacity duration-200', isPending && 'opacity-50 pointer-events-none')}
      >
        <MovimientosList
          items={paginatedItems}
          emptyMessage={
            searchQuery.trim() !== '' && selectedMonth !== 'all'
              ? `No se encontraron resultados en ${formatMonthLabel(selectedMonth)}. Cambiá el selector de mes a "Todos los meses" para buscar en toda la base de datos.`
              : "No se encontraron movimientos con los filtros seleccionados."
          }
        />

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 pb-2 border-t border-zinc-200/70 dark:border-zinc-800/70">
            {/* Range counter */}
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 order-2 sm:order-1">
              Mostrando{' '}
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{startIndex + 1}</span> a{' '}
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{endIndex}</span> de{' '}
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{filteredItems.length}</span>{' '}
              movimientos
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5 order-1 sm:order-2">
              {/* Botón Anterior */}
              <button
                type="button"
                onClick={() => goToPage(safeCurrentPage - 1)}
                disabled={safeCurrentPage <= 1}
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all',
                  safeCurrentPage <= 1
                    ? 'border-zinc-200/50 dark:border-zinc-800/50 text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-xs active:scale-95'
                )}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              {/* Números de página */}
              <div className="flex items-center gap-1">
                {pageNumbers.map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`dots-${idx}`} className="px-1.5 py-1 text-xs text-zinc-400 select-none">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = p === safeCurrentPage;
                  return (
                    <button
                      key={`page-${p}`}
                      type="button"
                      onClick={() => goToPage(p as number)}
                      className={cn(
                        'w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-all',
                        isCurrent
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20 scale-105'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700'
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              {/* Botón Siguiente */}
              <button
                type="button"
                onClick={() => goToPage(safeCurrentPage + 1)}
                disabled={safeCurrentPage >= totalPages}
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all',
                  safeCurrentPage >= totalPages
                    ? 'border-zinc-200/50 dark:border-zinc-800/50 text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-xs active:scale-95'
                )}
              >
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {filteredItems.length > 0 && totalPages === 1 && (
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 text-center text-xs font-medium text-zinc-400 dark:text-zinc-500">
            Mostrando todos los {filteredItems.length} movimientos de este período
          </div>
        )}
      </div>
    </section>
  );
}
