export type StatementPeriod = {
  month: number;
  year: number;
};

export function addMonthsToPeriod(
  period: StatementPeriod,
  monthsToAdd: number,
): StatementPeriod {
  const date = new Date(period.year, period.month - 1 + monthsToAdd, 1);

  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

export function getStatementPeriodForPurchase(
  purchasedAt: Date,
  closingDay: number,
): StatementPeriod {
  const purchaseDay = purchasedAt.getDate();
  const periodDate =
    purchaseDay <= closingDay
      ? new Date(purchasedAt.getFullYear(), purchasedAt.getMonth(), 1)
      : new Date(purchasedAt.getFullYear(), purchasedAt.getMonth() + 1, 1);

  return {
    month: periodDate.getMonth() + 1,
    year: periodDate.getFullYear(),
  };
}

export function getStatementDates(
  period: StatementPeriod,
  closingDay: number,
  dueDay: number,
) {
  const periodMonthIndex = period.month - 1;
  const closingDate = clampedDate(period.year, periodMonthIndex, closingDay);
  const dueMonthIndex = dueDay > closingDay ? periodMonthIndex : periodMonthIndex + 1;
  const dueDate = clampedDate(period.year, dueMonthIndex, dueDay);

  return {
    closingDate,
    dueDate,
  };
}

export function splitAmountIntoInstallments(totalAmount: number, count: number) {
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;

  return Array.from({ length: count }, (_, index) => {
    const cents = baseCents + (index < remainder ? 1 : 0);

    return cents / 100;
  });
}

export function getStatementStatus(
  totalAmount: number,
  paidAmount: number,
  closingDate: Date,
  dueDate: Date,
) {
  const now = new Date();

  if (totalAmount <= 0) {
    return "OPEN";
  }

  if (paidAmount >= totalAmount) {
    return "PAID";
  }

  if (paidAmount > 0) {
    return "PARTIALLY_PAID";
  }

  if (dueDate < now) {
    return "OVERDUE";
  }

  if (closingDate < now) {
    return "CLOSED";
  }

  return "OPEN";
}

export function getMonthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function clampedDate(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();

  return new Date(year, monthIndex, Math.min(day, lastDay));
}
