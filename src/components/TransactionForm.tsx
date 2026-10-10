'use client';

import { useState, useMemo, useEffect } from 'react';
import { useActionState } from 'react';
import { createTransactionAction } from '@/app/movimientos/nuevo/actions';
import { Plus, X, CheckCircle2, CreditCard, ArrowDownLeft, ArrowUpRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { calculateCardBillingMonth } from '@/lib/card-billing';

export function formatMoney(val: number | '', forceDecimals = false): string {
  if (val === '' || isNaN(val)) return '0,00';
  const hasDecimals = val % 1 !== 0;
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: forceDecimals || hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  }).format(val);
}

function getLocalDateString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function CurrencyInput({
  id,
  name,
  value,
  onChange,
  required = false,
  placeholder = '0',
  className = ''
}: {
  id?: string;
  name?: string;
  value: number | '';
  onChange: (val: number | '') => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const formatValue = (val: number | ''): string => {
    if (val === '' || isNaN(val)) return '';
    const hasDecimals = val % 1 !== 0;
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2
    }).format(val);
  };

  const [display, setDisplay] = useState<string>(() => formatValue(value));

  useEffect(() => {
    const parsedCurrent = parseNumeric(display);
    if (parsedCurrent !== value) {
      setDisplay(formatValue(value));
    }
  }, [value]);

  function parseNumeric(str: string): number | '' {
    if (!str || str.trim() === '') return '';
    let clean = str.trim();
    if (clean.includes(',') && clean.includes('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    } else if (/^\d+\.\d{1,2}$/.test(clean)) {
      // Decimal con punto único sin separadores de miles
    } else {
      clean = clean.replace(/\./g, '');
    }
    const num = parseFloat(clean);
    return isNaN(num) ? '' : num;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    if (!raw || raw.trim() === '') {
      setDisplay('');
      onChange('');
      return;
    }

    // Si termina en punto (ej. presiona punto en teclado numérico), tratarlo como coma decimal
    if (raw.endsWith('.')) {
      raw = raw.slice(0, -1) + ',';
    }

    // Si pega un número con punto decimal único (ej. 1500.50 y sin comas)
    if (!raw.includes(',') && /^\d+\.\d{1,2}$/.test(raw)) {
      raw = raw.replace('.', ',');
    }

    const isTrailingDecimal = raw.endsWith(',');

    const parts = raw.split(',');
    // La parte entera limpia de cualquier carácter no numérico (elimina los puntos de miles)
    const wholeRaw = parts[0].replace(/\D/g, '');
    // La parte decimal limpia de no numéricos, máximo 2 dígitos
    const decimalRaw = parts.length > 1 ? parts[1].replace(/\D/g, '').slice(0, 2) : null;

    if (!wholeRaw && decimalRaw === null) {
      setDisplay('');
      onChange('');
      return;
    }

    const wholeNum = wholeRaw ? Number(wholeRaw) : 0;
    const wholeFormatted = wholeRaw ? new Intl.NumberFormat('es-AR').format(wholeNum) : '0';

    let nextDisplay = wholeFormatted;
    let nextNumeric: number | '' = wholeNum;

    if (decimalRaw !== null && decimalRaw.length > 0) {
      nextDisplay = `${wholeFormatted},${decimalRaw}`;
      nextNumeric = Number(`${wholeRaw || '0'}.${decimalRaw}`);
    } else if (isTrailingDecimal || (parts.length > 1 && decimalRaw === '')) {
      nextDisplay = `${wholeFormatted},`;
      nextNumeric = wholeNum;
    } else {
      nextDisplay = wholeFormatted;
      nextNumeric = wholeNum;
    }

    setDisplay(nextDisplay);
    onChange(nextNumeric);
  };

  const handleBlur = () => {
    if (display.endsWith(',')) {
      setDisplay(display.slice(0, -1));
    }
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={value !== '' ? value : ''} />}
      <input
        type="text"
        inputMode="decimal"
        id={id}
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        className={className}
      />
    </>
  );
}

function formatBillingMonthLabel(monthStr: string) {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return monthStr;
  const [year, m] = monthStr.split('-');
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthName = months[parseInt(m, 10) - 1] || m;
  return `${monthName} ${year}`;
}

export default function TransactionForm({
  people,
  paymentMethods,
  parsedDefaults
}: {
  people: any[];
  paymentMethods: any[];
  parsedDefaults: any;
}) {
  const [state, formAction] = useActionState(createTransactionAction, null);

  const defaultPayerId = useMemo(() => {
    return (
      people.find(p => p.is_owner)?.id ||
      people.find(p => p.name.toLowerCase().includes('augusto'))?.id ||
      people[0]?.id ||
      ''
    );
  }, [people]);

  const [type, setType] = useState(parsedDefaults?.type || 'expense');
  const [date, setDate] = useState<string>(() => parsedDefaults?.date || getLocalDateString());
  const [amount, setAmount] = useState<number | ''>(parsedDefaults?.amount ? Number(parsedDefaults.amount) : '');
  const [description, setDescription] = useState(parsedDefaults?.description || '');
  const [paymentMethodId, setPaymentMethodId] = useState(parsedDefaults?.payment_method_id || '');

  const [isDivided, setIsDivided] = useState<boolean>(() => (parsedDefaults?.splits?.length ?? 0) > 1);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (state?.success) {
      setShowToast(true);
      setAmount('');
      setDescription('');
      setIsDivided(false);
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [state]);

  // Filtrar medios de pago: en ingresos, las tarjetas de crédito NO aparecen directamente
  const availablePaymentMethods = useMemo(() => {
    if (type === 'income') {
      return paymentMethods.filter(pm => pm.type !== 'credit_card');
    }
    return paymentMethods;
  }, [paymentMethods, type]);

  const [splits, setSplits] = useState<Array<{ id: string; person_id: string; amount: number | '' }>>(() => {
    if (parsedDefaults?.splits?.length > 0) {
      return parsedDefaults.splits.map((s: any) => ({
        id: crypto.randomUUID(),
        person_id: s.person_id,
        amount: Number(s.amount)
      }));
    }
    return [];
  });

  const selectedPaymentMethod = useMemo(() => {
    return paymentMethods.find(pm => pm.id === paymentMethodId);
  }, [paymentMethods, paymentMethodId]);

  const isCreditCard = selectedPaymentMethod?.type === 'credit_card';

  const autoBillingMonth = useMemo(() => {
    if (!isCreditCard) return date.substring(0, 7);
    return calculateCardBillingMonth(
      date,
      selectedPaymentMethod?.closing_day,
      selectedPaymentMethod?.due_day
    );
  }, [date, isCreditCard, selectedPaymentMethod]);

  // Cuando cambia a ingreso:
  // Si el medio de pago seleccionado es tarjeta de crédito, cambiarlo al primer medio no tarjeta
  useEffect(() => {
    if (type === 'income') {
      const isCardSelected = paymentMethods.find(pm => pm.id === paymentMethodId)?.type === 'credit_card';
      if (isCardSelected || !paymentMethodId) {
        const firstNonCard = paymentMethods.find(pm => pm.type !== 'credit_card');
        if (firstNonCard) setPaymentMethodId(firstNonCard.id);
      }
    }
  }, [type, paymentMethodId, paymentMethods]);

  const distributeEvenly = (
    splitList: Array<{ id: string; person_id: string; amount: number | '' }>,
    totalVal: number | ''
  ): Array<{ id: string; person_id: string; amount: number | '' }> => {
    if (totalVal === '' || isNaN(Number(totalVal)) || splitList.length === 0) {
      return splitList.map(s => ({ ...s, amount: 0 }));
    }
    const total = Number(totalVal);
    const count = splitList.length;
    if (count === 1) {
      return [{ ...splitList[0], amount: total }];
    }
    const splitAmount = parseFloat((total / count).toFixed(2));
    const remainder = parseFloat((total - splitAmount * count).toFixed(2));

    return splitList.map((s, i) => ({
      ...s,
      amount: i === 0 ? parseFloat((splitAmount + remainder).toFixed(2)) : splitAmount
    }));
  };

  const addSplit = () => {
    const next = [...splits, { id: crypto.randomUUID(), person_id: '', amount: 0 }];
    setSplits(distributeEvenly(next, amount));
  };

  const removeSplit = (id: string) => {
    const remaining = splits.filter(s => s.id !== id);
    setSplits(distributeEvenly(remaining, amount));
  };

  const splitEvenly = () => {
    setSplits(distributeEvenly(splits, amount));
  };

  // Si hay un solo responsable asignado, mantenerlo siempre al 100% del monto total
  useEffect(() => {
    if (isDivided && splits.length === 1) {
      const currentTotal = amount !== '' ? Number(amount) : 0;
      if (splits[0].amount !== currentTotal) {
        setSplits([{ ...splits[0], amount: currentTotal }]);
      }
    }
  }, [amount, isDivided, splits]);

  const effectiveSplits = useMemo(() => {
    if (type === 'income' || !isDivided) {
      return [
        {
          id: 'single-payer-split',
          person_id: defaultPayerId,
          amount: amount !== '' ? Number(amount) : 0
        }
      ];
    }
    return splits;
  }, [type, isDivided, defaultPayerId, amount, splits]);

  const totalSplits = effectiveSplits.reduce((acc, s) => acc + Number(s.amount || 0), 0);
  const splitsMatch =
    amount !== '' &&
    Number(amount) > 0 &&
    (type === 'income' || !isDivided || Math.abs(totalSplits - Number(amount)) < 0.01);
  const splitsJson = JSON.stringify(
    effectiveSplits.map(s => ({ person_id: s.person_id, amount: Number(s.amount) }))
  );

  return (
    <section className="max-w-2xl mx-auto space-y-6 relative">
      {showToast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-500/60 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" />
          <span className="text-sm font-medium">Movimiento agregado correctamente</span>
          <button
            type="button"
            onClick={() => setShowToast(false)}
            className="ml-2 text-white/80 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors"
            aria-label="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Cargar Movimiento
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {type === 'expense' ? 'Registra un gasto personal o compartido' : 'Registra un ingreso a tus cuentas'}
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm hover:shadow transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
      </div>

      <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-xl shadow-zinc-200/30 dark:shadow-black/40 border border-zinc-200/80 dark:border-zinc-800/80">
        <form action={formAction} className="space-y-6">
          {/* Animated Segmented Switcher */}
          <div className="relative flex p-1.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={cn(
                'relative flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-colors rounded-xl z-10',
                type === 'expense'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              )}
            >
              {type === 'expense' && (
                <motion.div
                  layoutId="active-transaction-type"
                  className="absolute inset-0 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200/70 dark:border-zinc-700/70 -z-10"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <ArrowUpRight className="w-4 h-4" />
              <span>Egreso</span>
            </button>

            <button
              type="button"
              onClick={() => setType('income')}
              className={cn(
                'relative flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-colors rounded-xl z-10',
                type === 'income'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              )}
            >
              {type === 'income' && (
                <motion.div
                  layoutId="active-transaction-type"
                  className="absolute inset-0 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200/70 dark:border-zinc-700/70 -z-10"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <ArrowDownLeft className="w-4 h-4" />
              <span>Ingreso</span>
            </button>

            {/* Hidden input for form action */}
            <input type="hidden" name="type" value={type} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="date" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Fecha
              </label>
              <input
                type="date"
                id="date"
                name="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-900/50 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm p-3 text-sm font-medium transition-all"
              />
            </div>
            <div>
              <label htmlFor="amount" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Monto Total
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-zinc-400 font-bold text-sm">$</span>
                <CurrencyInput
                  id="amount"
                  name="amount"
                  value={amount}
                  onChange={val => setAmount(val)}
                  required
                  placeholder="0,00"
                  className="w-full pl-8 pr-4 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-900/50 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm p-3 text-sm font-bold text-zinc-900 dark:text-zinc-100 transition-all"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="description" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Descripción
              </label>
              <input
                type="text"
                id="description"
                name="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
                placeholder={type === 'income' ? 'Ej: Sueldo, Honorarios, Reintegro' : 'Ej: Supermercado o Cena'}
                className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-900/50 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm p-3 text-sm font-medium transition-all"
              />
            </div>
            {/* Pagador: siempre es el usuario (Augusto / owner) */}
            <input type="hidden" name="payer_person_id" value={defaultPayerId} />

            <div className="sm:col-span-2">
              <label htmlFor="payment_method_id" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Medio de pago
              </label>
              <select
                id="payment_method_id"
                name="payment_method_id"
                value={paymentMethodId}
                onChange={e => setPaymentMethodId(e.target.value)}
                required
                className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-900/50 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm p-3 text-sm font-medium transition-all"
              >
                <option value="">Seleccionar...</option>
                {availablePaymentMethods.map(method => (
                  <option key={method.id} value={method.id}>
                    {method.name}{method.card_name && method.card_name !== method.name && type === 'expense' ? ` (${method.card_name})` : ''}
                  </option>
                ))}
              </select>
              {type === 'income' && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 ml-1">
                  En ingresos solo se muestran billeteras y cuentas (no tarjetas).
                </p>
              )}
            </div>

            {isCreditCard && type === 'expense' && (
              <div className="sm:col-span-2 space-y-3 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 dark:from-blue-950/20 dark:to-indigo-950/20 p-4 rounded-2xl border border-blue-200/60 dark:border-blue-800/40 mt-1 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="font-semibold text-blue-900 dark:text-blue-200">
                      Resumen a pagar en:
                    </span>
                    <span className="font-bold text-blue-700 dark:text-blue-400 text-sm">
                      {formatBillingMonthLabel(autoBillingMonth)}
                    </span>
                  </div>
                  {(selectedPaymentMethod?.closing_day || selectedPaymentMethod?.due_day) && (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {selectedPaymentMethod?.closing_day ? `Cierre: día ${selectedPaymentMethod.closing_day}` : ''}
                      {selectedPaymentMethod?.closing_day && selectedPaymentMethod?.due_day ? ' • ' : ''}
                      {selectedPaymentMethod?.due_day ? `Vencimiento: día ${selectedPaymentMethod.due_day}` : ''}
                    </span>
                  )}
                </div>

                <input type="hidden" name="impact_month" value={autoBillingMonth} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label htmlFor="installments_total" className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                      Cantidad de cuotas
                    </label>
                    <input
                      type="number"
                      id="installments_total"
                      name="installments_total"
                      min="1"
                      max="120"
                      defaultValue="1"
                      required
                      className="w-full rounded-xl border border-blue-200/70 dark:border-blue-800/60 bg-white dark:bg-zinc-900 shadow-sm p-2.5 text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label htmlFor="starting_installment" className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                      Cargar a partir de la cuota
                    </label>
                    <input
                      type="number"
                      id="starting_installment"
                      name="starting_installment"
                      min="1"
                      max="120"
                      defaultValue="1"
                      required
                      className="w-full rounded-xl border border-blue-200/70 dark:border-blue-800/60 bg-white dark:bg-zinc-900 shadow-sm p-2.5 text-sm font-medium"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {type === 'expense' && (
            <div className="pt-1">
              {!isDivided ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsDivided(true);
                    const otherPerson =
                      people.find(p => p.id !== defaultPayerId)?.id || '';
                    setSplits(
                      distributeEvenly(
                        [
                          {
                            id: crypto.randomUUID(),
                            person_id: defaultPayerId,
                            amount: 0
                          },
                          { id: crypto.randomUUID(), person_id: otherPerson, amount: 0 }
                        ],
                        amount
                      )
                    );
                  }}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 bg-blue-50 dark:bg-blue-950/40 px-4 py-2 rounded-full border border-blue-100 dark:border-blue-900/30 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Dividir gasto
                </button>
              ) : (
                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 bg-zinc-50/40 dark:bg-zinc-900/30">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      ¿Quiénes se hacen cargo? (Splits)
                    </h3>
                    <div className="flex items-center gap-3">
                      {splits.length > 1 && (
                        <button
                          type="button"
                          onClick={splitEvenly}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Dividir en partes iguales
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsDivided(false)}
                        className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 underline"
                      >
                        Cancelar división
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {splits.map((split, i) => (
                      <div key={split.id} className="flex gap-2 items-center">
                        <select
                          value={split.person_id}
                          onChange={e => {
                            const newSplits = [...splits];
                            newSplits[i].person_id = e.target.value;
                            setSplits(newSplits);
                          }}
                          required
                          className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 p-2.5 border text-sm font-medium shadow-sm"
                        >
                          <option value="">Persona...</option>
                          {people.map(person => (
                            <option key={person.id} value={person.id}>
                              {person.name} {person.is_owner ? '(Yo)' : ''}
                            </option>
                          ))}
                        </select>
                        <div className="relative w-1/3">
                          <span className="absolute left-2.5 top-2.5 text-zinc-400 text-sm font-bold">$</span>
                          <CurrencyInput
                            value={split.amount}
                            onChange={val => {
                              const newSplits = [...splits];
                              newSplits[i].amount = val !== '' ? val : 0;
                              setSplits(newSplits);
                            }}
                            required
                            className="w-full pl-7 pr-3 rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 p-2.5 border text-sm font-bold shadow-sm"
                          />
                        </div>
                        {splits.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSplit(split.id)}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                            title="Quitar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-3.5">
                    <button
                      type="button"
                      onClick={addSplit}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar persona
                    </button>
                  </div>

                  <div
                    className={cn(
                      "mt-4 flex items-center justify-between p-3.5 rounded-2xl border shadow-sm text-sm font-medium",
                      splitsMatch
                        ? 'bg-green-50/60 dark:bg-green-950/20 border-green-200/80 dark:border-green-800/60 text-green-800 dark:text-green-300'
                        : 'bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/80 dark:border-orange-800/60 text-orange-800 dark:text-orange-300'
                    )}
                  >
                    <span className="text-zinc-600 dark:text-zinc-400">Total asignado:</span>
                    <span className="font-bold">
                      $ {formatMoney(totalSplits, true)} / $ {amount !== '' ? formatMoney(amount, true) : '0,00'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <input type="hidden" name="splits" value={splitsJson} />

          {state?.error && (
            <div className="p-4 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-2xl text-sm font-semibold border border-red-100 dark:border-red-800 shadow-sm">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={!splitsMatch || !amount || Number(amount) <= 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-md shadow-blue-500/20 disabled:shadow-none active:scale-[0.99]"
          >
            Guardar Movimiento
          </button>
        </form>
      </div>
    </section>
  );
}
