import { getMonthLabel, getStatementStatus } from "@/features/cards/helpers";
import { requireActiveWorkspace } from "@/features/workspaces/queries";
import { prisma } from "@/lib/prisma";

export type CardStatementOverview = {
  balance: number;
  closingDate: Date;
  dueDate: Date;
  id: string;
  installmentTotal: number;
  monthLabel: string;
  paidTotal: number;
  periodMonth: number;
  periodYear: number;
  reminderDueAt?: Date;
  status: "OPEN" | "CLOSED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
};

export type CardPurchaseOverview = {
  categoryName?: string;
  description: string;
  firstDueDate?: Date;
  id: string;
  installmentsCount: number;
  merchant?: string;
  purchasedAt: Date;
  registeredInstallmentsCount: number;
  totalAmount: number;
};

export type CreditCardOverview = {
  availableCredit?: number;
  closingDay: number;
  color: string;
  creditLimit?: number;
  currency: string;
  currentDebt: number;
  dueDay: number;
  id: string;
  issuer?: string;
  lastFour?: string;
  name: string;
  network: string;
  nextDueStatement?: CardStatementOverview;
  paymentAccountId?: string;
  paymentAccountName?: string;
  purchases: CardPurchaseOverview[];
  statements: CardStatementOverview[];
};

export type CardForecastMonth = {
  amount: number;
  label: string;
  month: number;
  year: number;
};

export async function getCardsPageData() {
  const activeWorkspace = await requireActiveWorkspace();
  const [cards, accounts, categories] = await Promise.all([
    prisma.creditCard.findMany({
      where: {
        deletedAt: null,
        workspaceId: activeWorkspace.workspace.id,
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        paymentAccount: true,
        purchases: {
          where: {
            deletedAt: null,
            status: "ACTIVE",
          },
          orderBy: {
            purchasedAt: "desc",
          },
          take: 8,
          include: {
            category: true,
            installments: {
              where: {
                deletedAt: null,
              },
              orderBy: {
                installmentNumber: "asc",
              },
            },
          },
        },
        statements: {
          where: {
            deletedAt: null,
          },
          orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
          take: 12,
          include: {
            installments: {
              where: {
                deletedAt: null,
                status: {
                  not: "CANCELED",
                },
              },
            },
            payments: {
              where: {
                deletedAt: null,
              },
            },
            reminders: {
              where: {
                deletedAt: null,
                status: {
                  in: ["PENDING", "SNOOZED"],
                },
              },
              orderBy: {
                dueAt: "asc",
              },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.financialAccount.findMany({
      where: {
        deletedAt: null,
        workspaceId: activeWorkspace.workspace.id,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.category.findMany({
      where: {
        deletedAt: null,
        type: {
          in: ["EXPENSE", "BOTH"],
        },
        workspaceId: activeWorkspace.workspace.id,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  const cardOverviews = cards.map((card): CreditCardOverview => {
    const statements = card.statements.map((statement): CardStatementOverview => {
      const installmentTotal = statement.installments.reduce(
        (total, installment) => total + Number(installment.amount),
        0,
      );
      const paidTotal = statement.payments.reduce(
        (total, payment) => total + Number(payment.amount),
        0,
      );
      const balance = Math.max(installmentTotal - paidTotal, 0);
      const status = getStatementStatus(
        installmentTotal,
        paidTotal,
        statement.closingDate,
        statement.dueDate,
      );

      return {
        balance,
        closingDate: statement.closingDate,
        dueDate: statement.dueDate,
        id: statement.id,
        installmentTotal,
        monthLabel: getMonthLabel(statement.periodYear, statement.periodMonth),
        paidTotal,
        periodMonth: statement.periodMonth,
        periodYear: statement.periodYear,
        reminderDueAt: statement.reminders[0]?.dueAt,
        status,
      };
    });

    const currentDebt = statements.reduce(
      (total, statement) => total + statement.balance,
      0,
    );
    const creditLimit = card.creditLimit ? Number(card.creditLimit) : undefined;
    const nextDueStatement = statements
      .filter((statement) => statement.balance > 0)
      .sort((first, second) => first.dueDate.getTime() - second.dueDate.getTime())[0];

    return {
      availableCredit:
        creditLimit === undefined ? undefined : Math.max(creditLimit - currentDebt, 0),
      closingDay: card.closingDay,
      color: card.color ?? "#378add",
      creditLimit,
      currency: card.currency,
      currentDebt,
      dueDay: card.dueDay,
      id: card.id,
      issuer: card.issuer ?? undefined,
      lastFour: card.lastFour ?? undefined,
      name: card.name,
      network: card.network,
      nextDueStatement,
      paymentAccountId: card.paymentAccountId ?? undefined,
      paymentAccountName: card.paymentAccount?.name,
      purchases: card.purchases.map((purchase) => ({
        categoryName: purchase.category?.name,
        description: purchase.description,
        firstDueDate: purchase.installments[0]?.dueDate ?? undefined,
        id: purchase.id,
        installmentsCount: purchase.installmentsCount,
        merchant: purchase.merchant ?? undefined,
        purchasedAt: purchase.purchasedAt,
        registeredInstallmentsCount: purchase.installments.length,
        totalAmount: Number(purchase.totalAmount),
      })),
      statements,
    };
  });

  return {
    accounts,
    cards: cardOverviews,
    categories,
    forecast: getDebtForecast(cardOverviews),
    workspace: activeWorkspace.workspace,
  };
}

function getDebtForecast(cards: CreditCardOverview[]): CardForecastMonth[] {
  const forecast = new Map<string, CardForecastMonth>();

  for (const card of cards) {
    for (const statement of card.statements) {
      if (statement.balance <= 0) {
        continue;
      }

      const key = `${statement.periodYear}-${statement.periodMonth}`;
      const current = forecast.get(key);

      forecast.set(key, {
        amount: (current?.amount ?? 0) + statement.balance,
        label: statement.monthLabel,
        month: statement.periodMonth,
        year: statement.periodYear,
      });
    }
  }

  return Array.from(forecast.values()).sort((first, second) => {
    if (first.year === second.year) {
      return first.month - second.month;
    }

    return first.year - second.year;
  });
}
