import { requireActiveWorkspace } from "@/features/workspaces/queries";
import { prisma } from "@/lib/prisma";

export async function getTransactionsForActiveWorkspace() {
  const activeWorkspace = await requireActiveWorkspace();

  return prisma.transaction.findMany({
    where: {
      deletedAt: null,
      type: {
        in: ["INCOME", "EXPENSE"],
      },
      workspaceId: activeWorkspace.workspace.id,
    },
    orderBy: {
      occurredAt: "desc",
    },
    include: {
      category: true,
      fromAccount: true,
      toAccount: true,
    },
  });
}

export async function getCurrentMonthSummary() {
  const activeWorkspace = await requireActiveWorkspace();
  const now = new Date();
  const startsAt = new Date(now.getFullYear(), now.getMonth(), 1);
  const endsAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const transactions = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      occurredAt: {
        gte: startsAt,
        lt: endsAt,
      },
      type: {
        in: ["INCOME", "EXPENSE"],
      },
      workspaceId: activeWorkspace.workspace.id,
    },
    select: {
      amount: true,
      type: true,
    },
  });

  return transactions.reduce(
    (summary, transaction) => {
      if (transaction.type === "INCOME") {
        summary.income += Number(transaction.amount);
      }

      if (transaction.type === "EXPENSE") {
        summary.expense += Number(transaction.amount);
      }

      return summary;
    },
    { expense: 0, income: 0 },
  );
}

export async function getWorkspaceBalance() {
  const activeWorkspace = await requireActiveWorkspace();
  const accounts = await prisma.financialAccount.findMany({
    where: {
      deletedAt: null,
      workspaceId: activeWorkspace.workspace.id,
    },
    select: {
      openingBalance: true,
    },
  });
  const transactions = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      type: {
        in: ["INCOME", "EXPENSE"],
      },
      workspaceId: activeWorkspace.workspace.id,
    },
    select: {
      amount: true,
      type: true,
    },
  });

  const openingBalance = accounts.reduce(
    (total, account) => total + Number(account.openingBalance),
    0,
  );

  return transactions.reduce((total, transaction) => {
    if (transaction.type === "INCOME") {
      return total + Number(transaction.amount);
    }

    if (transaction.type === "EXPENSE") {
      return total - Number(transaction.amount);
    }

    return total;
  }, openingBalance);
}
