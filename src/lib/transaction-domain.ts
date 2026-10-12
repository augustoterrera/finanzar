import { addMonths } from './card-billing';

export type TransactionSplitInput = { person_id: string; amount: number };
export type ScheduledInstallment = {
  installmentNumber: number;
  month: string;
  date: string;
  amount: number;
  splits: TransactionSplitInput[];
};

/** Parse ARS input without using floating-point arithmetic for the cents. */
export function parseMoneyToCents(value: string): number | null {
  if (!value) return null;
  let clean = value.trim();

  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  } else if (/\.\d{3}/.test(clean) && !/\.\d{1,2}$/.test(clean)) {
    clean = clean.replace(/\./g, '');
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return null;
  const [whole, decimal = ''] = clean.split('.');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function parseSplitToCents(value: unknown): number | null {
	if (typeof value === 'string') {
		const clean = value.trim();
		if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return null;
		const [whole, decimal = ''] = clean.split('.');
		const cents = BigInt(whole) * BigInt(100) + BigInt(decimal.padEnd(2, '0'));
		return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
	}
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && Number((cents / 100).toFixed(2)) === value ? cents : null;
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isValidYearMonth(value: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 1 && year <= 9999;
}

/** Split a purchase's total into its full installment calendar. */
export function buildInstallmentSchedule(input: {
  splits: TransactionSplitInput[];
  installmentsTotal: number;
  startingInstallment: number;
  billingMonth: string;
  dateDay: number;
  dueDay?: number | null;
}): ScheduledInstallment[] {
  const { splits, installmentsTotal, startingInstallment, billingMonth, dateDay, dueDay } = input;
  if (!Number.isInteger(installmentsTotal) || installmentsTotal < 1 || installmentsTotal > 120) {
    throw new RangeError('La cantidad de cuotas debe ser un entero entre 1 y 120');
  }
  if (!Number.isInteger(startingInstallment) || startingInstallment < 1 || startingInstallment > installmentsTotal) {
    throw new RangeError('La cuota inicial debe estar entre 1 y el total de cuotas');
  }
  if (!isValidYearMonth(billingMonth)) throw new RangeError('El mes de impacto no es válido');
  if (!Number.isInteger(dateDay) || dateDay < 1 || dateDay > 31) throw new RangeError('El día no es válido');
  if (dueDay != null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
    throw new RangeError('El día de vencimiento no es válido');
  }
  if (splits.length === 0 || splits.some((split) => !split.person_id || !Number.isSafeInteger(split.amount) || split.amount < 0)) {
    throw new RangeError('Las divisiones del gasto no son válidas');
  }

  return Array.from({ length: installmentsTotal - startingInstallment + 1 }, (_, offset) => {
    const installmentNumber = startingInstallment + offset;
    const month = addMonths(billingMonth, offset);
    const [year, monthNumber] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const day = Math.min(dueDay ?? dateDay, daysInMonth);
    const installmentSplits = splits.map((split) => {
      const base = Math.floor(split.amount / installmentsTotal);
      const remainder = split.amount % installmentsTotal;
      return {
        person_id: split.person_id,
        amount: base + (installmentNumber > installmentsTotal - remainder ? 1 : 0),
      };
    });

    return {
      installmentNumber,
      month,
      date: `${month}-${String(day).padStart(2, '0')}`,
      amount: installmentSplits.reduce((total, split) => total + split.amount, 0),
      splits: installmentSplits,
    };
  });
}
