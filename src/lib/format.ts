/**
 * Utilidades de formateo para números y moneda en pesos argentinos (es-AR)
 */

/**
 * Formatea un valor en centavos a pesos argentinos: ej. 71943138 -> "$ 719.431,38"
 */
export function formatCents(cents: number): string {
  const isNegative = cents < 0;
  const value = Math.abs(cents) / 100;
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  return `${isNegative ? '-' : ''}$ ${formatted}`;
}

/**
 * Formatea un valor decimal en pesos: ej. 200000 -> "$ 200.000,00"
 */
export function formatCurrency(amount: number, forceDecimals = true): string {
  const isNegative = amount < 0;
  const value = Math.abs(amount);
  const hasDecimals = value % 1 !== 0;
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: forceDecimals || hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  }).format(value);
  return `${isNegative ? '-' : ''}$ ${formatted}`;
}

/**
 * Parsea un string de moneda (con puntos de miles o coma decimal) a centavos enteros
 */
export function parseMoneyToCents(value: string): number | null {
  if (!value) return null;
  let clean = value.trim();

  // Si tiene puntos de miles y coma decimal (ej: 200.000,50)
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  } else if (/\.\d{3}/.test(clean) && !/\.\d{1,2}$/.test(clean)) {
    // Puntos como separadores de miles (ej: 200.000 o 1.500.000)
    clean = clean.replace(/\./g, '');
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return null;
  const [whole, decimal = ''] = clean.split('.');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
