import { requireActiveWorkspace } from "@/features/workspaces/queries";
import { prisma } from "@/lib/prisma";

export type RecurringRuleOverview = {
  accountName?: string;
  amount: number;
  categoryName?: string;
  currency: string;
  description: string;
  frequency: string;
  id: string;
  nextRunAt?: Date;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "CARD_PAYMENT" | "ADJUSTMENT";
};

export type SubscriptionOverview = {
  amount: number;
  categoryName?: string;
  currency: string;
  id: string;
  name: string;
  nextBillingAt?: Date;
  paymentSource?: string;
  provider?: string;
};

export type BudgetOverview = {
  amount: number;
  categoryName?: string;
  currency: string;
  endsAt: Date;
  id: string;
  name: string;
  spent: number;
  startsAt: Date;
};

export type ReminderOverview = {
  description?: string;
  dueAt: Date;
  id: string;
  status: string;
  title: string;
};

export type CashflowEvent = {
  amount: number;
  currency: string;
  date: Date;
  id: string;
  label: string;
  source: "recurring" | "subscription" | "card";
  type: "income" | "expense";
};

export async function getPlanningPageData() {
  const activeWorkspace = await requireActiveWorkspace();
  const now = new Date();
  const forecastEndsAt = new Date(now);
  forecastEndsAt.setDate(forecastEndsAt.getDate() + 60);

  const [accounts, categories, cards, recurringRules, subscriptions, budgets, reminders, statements] =
    await Promise.all([
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
          workspaceId: activeWorkspace.workspace.id,
        },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      }),
      prisma.creditCard.findMany({
        where: {
          deletedAt: null,
          workspaceId: activeWorkspace.workspace.id,
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.recurringRule.findMany({
        where: {
          deletedAt: null,
          status: "ACTIVE",
          workspaceId: activeWorkspace.workspace.id,
        },
        orderBy: {
          nextRunAt: "asc",
        },
        include: {
          category: true,
          destinationAccount: true,
          sourceAccount: true,
        },
      }),
      prisma.subscription.findMany({
        where: {
          deletedAt: null,
          status: "ACTIVE",
          workspaceId: activeWorkspace.workspace.id,
        },
        orderBy: {
          nextBillingAt: "asc",
        },
        include: {
          category: true,
          creditCard: true,
          sourceAccount: true,
        },
      }),
      prisma.budget.findMany({
        where: {
          deletedAt: null,
          workspaceId: activeWorkspace.workspace.id,
        },
        orderBy: {
          startsAt: "desc",
        },
        include: {
          category: true,
        },
      }),
      prisma.reminder.findMany({
        where: {
          deletedAt: null,
          status: {
            in: ["PENDING", "SNOOZED"],
          },
          workspaceId: activeWorkspace.workspace.id,
        },
        orderBy: {
          dueAt: "asc",
        },
        take: 12,
      }),
      prisma.creditCardStatement.findMany({
        where: {
          deletedAt: null,
          dueDate: {
            gte: now,
            lte: forecastEndsAt,
          },
          status: {
            in: ["OPEN", "CLOSED", "PARTIALLY_PAID", "OVERDUE"],
          },
          workspaceId: activeWorkspace.workspace.id,
        },
        include: {
          creditCard: true,
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
        },
      }),
    ]);

  const budgetSpending = await getBudgetSpending(
    activeWorkspace.workspace.id,
    budgets.map((budget) => ({
      categoryId: budget.categoryId,
      endsAt: budget.endsAt,
      id: budget.id,
      startsAt: budget.startsAt,
    })),
  );

  const recurringOverviews: RecurringRuleOverview[] = recurringRules.map((rule) => ({
    accountName: rule.sourceAccount?.name ?? rule.destinationAccount?.name,
    amount: Number(rule.amount),
    categoryName: rule.category?.name,
    currency: rule.currency,
    description: rule.description,
    frequency: rule.frequency,
    id: rule.id,
    nextRunAt: rule.nextRunAt ?? undefined,
    type: rule.type,
  }));

  const subscriptionOverviews: SubscriptionOverview[] = subscriptions.map(
    (subscription) => ({
      amount: Number(subscription.amount),
      categoryName: subscription.category?.name,
      currency: subscription.currency,
      id: subscription.id,
      name: subscription.name,
      nextBillingAt: subscription.nextBillingAt ?? undefined,
      paymentSource:
        subscription.creditCard?.name ?? subscription.sourceAccount?.name ?? undefined,
      provider: subscription.provider ?? undefined,
    }),
  );

  const budgetOverviews: BudgetOverview[] = budgets.map((budget) => ({
    amount: Number(budget.amount),
    categoryName: budget.category?.name,
    currency: budget.currency,
    endsAt: budget.endsAt,
    id: budget.id,
    name: budget.name,
    spent: budgetSpending.get(budget.id) ?? 0,
    startsAt: budget.startsAt,
  }));

  const reminderOverviews: ReminderOverview[] = reminders.map((reminder) => ({
    description: reminder.description ?? undefined,
    dueAt: reminder.dueAt,
    id: reminder.id,
    status: reminder.status,
    title: reminder.title,
  }));

  return {
    accounts,
    budgets: budgetOverviews,
    cards,
    cashflow: getCashflowEvents(
      recurringOverviews,
      subscriptionOverviews,
      statements,
      now,
      forecastEndsAt,
    ),
    categories,
    reminders: reminderOverviews,
    recurringRules: recurringOverviews,
    subscriptions: subscriptionOverviews,
    workspace: activeWorkspace.workspace,
  };
}

async function getBudgetSpending(
  workspaceId: string,
  budgets: Array<{
    categoryId: string | null;
    endsAt: Date;
    id: string;
    startsAt: Date;
  }>,
) {
  const spending = new Map<string, number>();

  await Promise.all(
    budgets.map(async (budget) => {
      const transactions = await prisma.transaction.findMany({
        where: {
          categoryId: budget.categoryId ?? undefined,
          deletedAt: null,
          occurredAt: {
            gte: budget.startsAt,
            lte: budget.endsAt,
          },
          type: "EXPENSE",
          workspaceId,
        },
        select: {
          amount: true,
        },
      });

      spending.set(
        budget.id,
        transactions.reduce(
          (total, transaction) => total + Number(transaction.amount),
          0,
        ),
      );
    }),
  );

  return spending;
}

function getCashflowEvents(
  recurringRules: RecurringRuleOverview[],
  subscriptions: SubscriptionOverview[],
  statements: Array<{
    creditCard: { currency: string; name: string };
    dueDate: Date;
    id: string;
    installments: Array<{ amount: unknown }>;
    payments: Array<{ amount: unknown }>;
  }>,
  startsAt: Date,
  endsAt: Date,
): CashflowEvent[] {
  const events: CashflowEvent[] = [];

  for (const rule of recurringRules) {
    if (!rule.nextRunAt || rule.nextRunAt < startsAt || rule.nextRunAt > endsAt) {
      continue;
    }

    events.push({
      amount: rule.type === "INCOME" ? rule.amount : -rule.amount,
      currency: rule.currency,
      date: rule.nextRunAt,
      id: `recurring-${rule.id}`,
      label: rule.description,
      source: "recurring",
      type: rule.type === "INCOME" ? "income" : "expense",
    });
  }

  for (const subscription of subscriptions) {
    if (
      !subscription.nextBillingAt ||
      subscription.nextBillingAt < startsAt ||
      subscription.nextBillingAt > endsAt
    ) {
      continue;
    }

    events.push({
      amount: -subscription.amount,
      currency: subscription.currency,
      date: subscription.nextBillingAt,
      id: `subscription-${subscription.id}`,
      label: subscription.name,
      source: "subscription",
      type: "expense",
    });
  }

  for (const statement of statements) {
    const totalAmount = statement.installments.reduce(
      (total, installment) => total + Number(installment.amount),
      0,
    );
    const paidAmount = statement.payments.reduce(
      (total, payment) => total + Number(payment.amount),
      0,
    );
    const balance = Math.max(totalAmount - paidAmount, 0);

    if (balance <= 0) {
      continue;
    }

    events.push({
      amount: -balance,
      currency: statement.creditCard.currency,
      date: statement.dueDate,
      id: `card-${statement.id}`,
      label: `Resumen ${statement.creditCard.name}`,
      source: "card",
      type: "expense",
    });
  }

  return events.sort((first, second) => first.date.getTime() - second.date.getTime());
}
