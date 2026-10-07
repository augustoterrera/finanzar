export function addMonths(monthStr: string, increment: number): string {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1 + increment, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Calcula el mes de vencimiento/pago del resumen de la tarjeta de crédito
 * en base a la fecha de compra, el día de cierre y el día de vencimiento.
 */
export function calculateCardBillingMonth(
  purchaseDate: string,
  closingDay?: number | null,
  dueDay?: number | null
): string {
  if (!purchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
    return new Date().toISOString().substring(0, 7);
  }

  const [yearStr, monthStr, dayStr] = purchaseDate.split('-');
  const purchaseYear = Number(yearStr);
  const purchaseMonth = Number(monthStr); // 1-12
  const purchaseDay = Number(dayStr);

  // Si no tiene configurado día de cierre, se toma el mes de la compra
  if (!closingDay || closingDay < 1 || closingDay > 31) {
    return `${yearStr}-${monthStr}`;
  }

  // 1. Determinar el mes en el que cierra el resumen de esta compra
  let closingYear = purchaseYear;
  let closingMonth = purchaseMonth; // 1-12

  if (purchaseDay > closingDay) {
    // La compra fue posterior al cierre -> entra en el resumen del mes siguiente
    const nextClosing = new Date(purchaseYear, purchaseMonth, closingDay);
    closingYear = nextClosing.getFullYear();
    closingMonth = nextClosing.getMonth() + 1;
  }

  // 2. Determinar el mes de vencimiento / pago del resumen
  if (dueDay && dueDay >= 1 && dueDay <= 31) {
    if (dueDay < closingDay) {
      // Caso estándar (ej. Cierra el 27, vence el 10 del mes siguiente)
      const dueDate = new Date(closingYear, closingMonth, 1);
      return `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
    } else {
      // Vence en el mismo mes del cierre (ej. Cierra el 5, vence el 20)
      return `${closingYear}-${String(closingMonth).padStart(2, '0')}`;
    }
  }

  // Si no hay día de vencimiento explícito:
  // Si cierra en la segunda mitad del mes (>15), el pago es al mes siguiente.
  if (closingDay > 15) {
    const dueDate = new Date(closingYear, closingMonth, 1);
    return `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
  }

  return `${closingYear}-${String(closingMonth).padStart(2, '0')}`;
}
