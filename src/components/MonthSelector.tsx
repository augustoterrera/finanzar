'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const MONTHS = [
  { short: 'Ene', full: 'Enero' },
  { short: 'Feb', full: 'Febrero' },
  { short: 'Mar', full: 'Marzo' },
  { short: 'Abr', full: 'Abril' },
  { short: 'May', full: 'Mayo' },
  { short: 'Jun', full: 'Junio' },
  { short: 'Jul', full: 'Julio' },
  { short: 'Ago', full: 'Agosto' },
  { short: 'Sep', full: 'Septiembre' },
  { short: 'Oct', full: 'Octubre' },
  { short: 'Nov', full: 'Noviembre' },
  { short: 'Dic', full: 'Diciembre' },
];

export default function MonthSelector({ currentMonth }: { currentMonth: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current selected month: YYYY-MM
  const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);
  const selectedYear = currentYear || new Date().getFullYear();
  const selectedMonthIndex = (currentMonthNum || new Date().getMonth() + 1) - 1;

  // Year being browsed in the picker
  const [viewYear, setViewYear] = useState(selectedYear);

  // Synchronize viewYear if selected year changes
  useEffect(() => {
    setViewYear(selectedYear);
  }, [selectedYear]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectMonth = (year: number, monthIdx: number) => {
    const formatted = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    setIsOpen(false);
    router.push(`/?month=${formatted}`);
  };

  const handlePrevMonth = () => {
    if (selectedMonthIndex === 0) {
      selectMonth(selectedYear - 1, 11);
    } else {
      selectMonth(selectedYear, selectedMonthIndex - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonthIndex === 11) {
      selectMonth(selectedYear + 1, 0);
    } else {
      selectMonth(selectedYear, selectedMonthIndex + 1);
    }
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    selectMonth(now.getFullYear(), now.getMonth());
  };

  const today = new Date();
  const isActualCurrentMonth =
    today.getFullYear() === selectedYear && today.getMonth() === selectedMonthIndex;

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Pill Trigger */}
      <div className="flex items-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-full shadow-sm border border-zinc-200/80 dark:border-zinc-800/80 p-1">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          title="Mes anterior"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>
            {MONTHS[selectedMonthIndex]?.full} {selectedYear}
          </span>
        </button>

        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          title="Mes siguiente"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2 z-50 w-72 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-4"
          >
            {/* Year Switcher Header */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setViewYear(viewYear - 1)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                aria-label="Año anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {viewYear}
              </span>

              <button
                type="button"
                onClick={() => setViewYear(viewYear + 1)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                aria-label="Año siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Months 3x4 Grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((m, idx) => {
                const isSelected = viewYear === selectedYear && idx === selectedMonthIndex;
                const isCurrentMonthNow =
                  today.getFullYear() === viewYear && today.getMonth() === idx;

                return (
                  <button
                    key={m.short}
                    type="button"
                    onClick={() => selectMonth(viewYear, idx)}
                    className={cn(
                      'py-2 px-1 text-xs font-semibold rounded-xl transition-all capitalize relative',
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm font-bold scale-[1.02]'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white',
                      isCurrentMonthNow && !isSelected && 'ring-1 ring-blue-500/50 text-blue-600 dark:text-blue-400'
                    )}
                  >
                    {m.short}
                    {isCurrentMonthNow && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Actions Footer */}
            <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleCurrentMonth}
                className={cn(
                  'font-semibold text-blue-600 dark:text-blue-400 hover:underline px-1 py-0.5 rounded',
                  isActualCurrentMonth && 'opacity-60 cursor-default hover:no-underline'
                )}
                disabled={isActualCurrentMonth}
              >
                Ir a este mes
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 px-1 py-0.5"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
