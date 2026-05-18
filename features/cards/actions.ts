"use server";

import { redirect } from "next/navigation";

import {
  addMonthsToPeriod,
  getStatementDates,
  getStatementPeriodForPurchase,
  getStatementStatus,
  splitAmountIntoInstallments,
  type StatementPeriod,
} from "@/features/cards/helpers";
import {
  cardPaymentSchema,
  cardPurchaseSchema,
  createCreditCardSchema,
  updateCreditCardSchema,
} from "@/features/cards/schemas";
import { requireActiveWorkspace } from "@/features/workspaces/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

type TransactionClient = Prisma.TransactionClient;

export async function createCreditCardAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const parsedInput = createCreditCardSchema.safeParse(getCreditCardInput(formData));

  if (!parsedInput.success) {
    redirect("/cards?error=invalid-card");
  }

  if (parsedInput.data.paymentAccountId) {
    await requireWorkspaceAccount(parsedInput.data.paymentAccountId, activeWorkspace.workspace.id);
  }

  await prisma.creditCard.create({
    data: {
      closingDay: parsedInput.data.closingDay,
      color: parsedInput.data.color,
      createdById: user.id,
      creditLimit: parsedInput.data.creditLimit,
      currency: parsedInput.data.currency,
      dueDay: parsedInput.data.dueDay,
      issuer: parsedInput.data.issuer,
      lastFour: parsedInput.data.lastFour,
      name: parsedInput.data.name,
      network: parsedInput.data.network ?? "OTHER",
      ownerMemberId: activeWorkspace.member.id,
      paymentAccountId: parsedInput.data.paymentAccountId,
      workspaceId: activeWorkspace.workspace.id,
    },
  });

  redirect("/cards");
}

export async function updateCreditCardAction(cardId: string, formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const parsedInput = updateCreditCardSchema.safeParse(getCreditCardInput(formData));

  if (!parsedInput.success) {
    redirect("/cards?error=invalid-card");
  }

  if (parsedInput.data.paymentAccountId) {
    await requireWorkspaceAccount(parsedInput.data.paymentAccountId, activeWorkspace.workspace.id);
  }

  await prisma.creditCard.updateMany({
    where: {
      deletedAt: null,
      id: cardId,
      workspaceId: activeWorkspace.workspace.id,
    },
    data: {
      closingDay: parsedInput.data.closingDay,
      color: parsedInput.data.color,
      creditLimit: parsedInput.data.creditLimit,
      currency: parsedInput.data.currency,
      dueDay: parsedInput.data.dueDay,
      issuer: parsedInput.data.issuer,
      lastFour: parsedInput.data.lastFour,
      name: parsedInput.data.name,
      network: parsedInput.data.network,
      paymentAccountId: parsedInput.data.paymentAccountId ?? null,
    },
  });

  redirect("/cards");
}

export async function deleteCreditCardAction(cardId: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();

  await prisma.creditCard.updateMany({
    where: {
      deletedAt: null,
      id: cardId,
      workspaceId: activeWorkspace.workspace.id,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  redirect("/cards");
}

export async function createCardPurchaseAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const parsedInput = cardPurchaseSchema.safeParse({
    categoryId: formData.get("categoryId"),
    creditCardId: formData.get("creditCardId"),
    description: formData.get("description"),
    firstInstallmentNumber: formData.get("firstInstallmentNumber") ?? "1",
    firstStatementPeriod: formData.get("firstStatementPeriod") ?? "",
    installmentsCount: formData.get("installmentsCount"),
    merchant: formData.get("merchant"),
    purchasedAt: formData.get("purchasedAt"),
    totalAmount: formData.get("totalAmount"),
  });

  if (!parsedInput.success) {
    redirect("/cards?error=invalid-purchase");
  }

  const card = await prisma.creditCard.findFirst({
    where: {
      deletedAt: null,
      id: parsedInput.data.creditCardId,
      workspaceId: activeWorkspace.workspace.id,
    },
    select: {
      closingDay: true,
      currency: true,
      dueDay: true,
      id: true,
      name: true,
    },
  });

  if (!card) {
    redirect("/cards?error=missing-card");
  }

  if (parsedInput.data.categoryId) {
    await requireWorkspaceCategory(parsedInput.data.categoryId, activeWorkspace.workspace.id);
  }

  await prisma.$transaction(async (tx) => {
    const purchase = await tx.creditCardPurchase.create({
      data: {
        categoryId: parsedInput.data.categoryId,
        createdById: user.id,
        creditCardId: card.id,
        currency: card.currency,
        description: parsedInput.data.description,
        installmentsCount: parsedInput.data.installmentsCount,
        merchant: parsedInput.data.merchant,
        purchasedAt: parsedInput.data.purchasedAt,
        totalAmount: parsedInput.data.totalAmount,
        workspaceId: activeWorkspace.workspace.id,
      },
    });

    const firstPeriod =
      parsedInput.data.firstStatementPeriod ??
      getStatementPeriodForPurchase(parsedInput.data.purchasedAt, card.closingDay);
    const installmentAmounts = splitAmountIntoInstallments(
      parsedInput.data.totalAmount,
      parsedInput.data.installmentsCount,
    );
    const statementIds = new Set<string>();
    const firstInstallmentIndex = parsedInput.data.firstInstallmentNumber - 1;

    for (let index = firstInstallmentIndex; index < installmentAmounts.length; index += 1) {
      const amount = installmentAmounts[index];
      const period = addMonthsToPeriod(firstPeriod, index - firstInstallmentIndex);
      const statement = await upsertStatementForPeriod(
        tx,
        activeWorkspace.workspace.id,
        card,
        period,
      );

      await tx.creditCardInstallment.create({
        data: {
          amount,
          currency: card.currency,
          dueDate: statement.dueDate,
          dueMonth: period.month,
          dueYear: period.year,
          installmentNumber: index + 1,
          purchaseId: purchase.id,
          statementId: statement.id,
          workspaceId: activeWorkspace.workspace.id,
        },
      });

      statementIds.add(statement.id);
    }

    for (const statementId of statementIds) {
      await refreshStatementStatus(tx, statementId);
    }
  });

  redirect("/cards");
}

export async function deleteCardPurchaseAction(purchaseId: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const purchase = await prisma.creditCardPurchase.findFirst({
    where: {
      deletedAt: null,
      id: purchaseId,
      workspaceId: activeWorkspace.workspace.id,
    },
    include: {
      installments: {
        select: {
          statementId: true,
        },
      },
    },
  });

  if (!purchase) {
    redirect("/cards?error=missing-purchase");
  }

  await prisma.$transaction(async (tx) => {
    await tx.creditCardPurchase.update({
      where: {
        id: purchase.id,
      },
      data: {
        deletedAt: new Date(),
        status: "CANCELED",
      },
    });

    await tx.creditCardInstallment.updateMany({
      where: {
        deletedAt: null,
        purchaseId: purchase.id,
        workspaceId: activeWorkspace.workspace.id,
      },
      data: {
        deletedAt: new Date(),
        status: "CANCELED",
      },
    });

    const statementIds = new Set(
      purchase.installments
        .map((installment) => installment.statementId)
        .filter((statementId): statementId is string => Boolean(statementId)),
    );

    for (const statementId of statementIds) {
      await refreshStatementStatus(tx, statementId);
    }
  });

  redirect("/cards");
}

export async function createCardPaymentAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const parsedInput = cardPaymentSchema.safeParse({
    accountId: formData.get("accountId"),
    amount: formData.get("amount"),
    creditCardId: formData.get("creditCardId"),
    notes: formData.get("notes"),
    paidAt: formData.get("paidAt"),
    statementId: formData.get("statementId"),
  });

  if (!parsedInput.success) {
    redirect("/cards?error=invalid-payment");
  }

  const [card, account] = await Promise.all([
    prisma.creditCard.findFirst({
      where: {
        deletedAt: null,
        id: parsedInput.data.creditCardId,
        workspaceId: activeWorkspace.workspace.id,
      },
      select: {
        currency: true,
        id: true,
        name: true,
      },
    }),
    prisma.financialAccount.findFirst({
      where: {
        deletedAt: null,
        id: parsedInput.data.accountId,
        workspaceId: activeWorkspace.workspace.id,
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  if (!card || !account) {
    redirect("/cards?error=missing-payment-data");
  }

  if (parsedInput.data.statementId) {
    await requireWorkspaceStatement(
      parsedInput.data.statementId,
      card.id,
      activeWorkspace.workspace.id,
    );
  }

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        amount: parsedInput.data.amount,
        createdById: user.id,
        currency: card.currency,
        description: `Pago de ${card.name}`,
        fromAccountId: account.id,
        occurredAt: parsedInput.data.paidAt,
        status: "CLEARED",
        type: "CARD_PAYMENT",
        workspaceId: activeWorkspace.workspace.id,
      },
    });

    await tx.creditCardPayment.create({
      data: {
        accountId: account.id,
        amount: parsedInput.data.amount,
        createdById: user.id,
        creditCardId: card.id,
        currency: card.currency,
        notes: parsedInput.data.notes,
        paidAt: parsedInput.data.paidAt,
        statementId: parsedInput.data.statementId,
        transactionId: transaction.id,
        workspaceId: activeWorkspace.workspace.id,
      },
    });

    if (parsedInput.data.statementId) {
      await refreshStatementStatus(tx, parsedInput.data.statementId);
    }
  });

  redirect("/cards");
}

function getCreditCardInput(formData: FormData) {
  return {
    closingDay: formData.get("closingDay"),
    color: formData.get("color"),
    creditLimit: formData.get("creditLimit"),
    currency: formData.get("currency"),
    dueDay: formData.get("dueDay"),
    issuer: formData.get("issuer"),
    lastFour: formData.get("lastFour"),
    name: formData.get("name"),
    network: formData.get("network") || undefined,
    paymentAccountId: formData.get("paymentAccountId"),
  };
}

async function requireWorkspaceAccount(accountId: string, workspaceId: string) {
  const account = await prisma.financialAccount.findFirst({
    where: {
      deletedAt: null,
      id: accountId,
      workspaceId,
    },
    select: {
      id: true,
    },
  });

  if (!account) {
    redirect("/cards?error=missing-account");
  }

  return account;
}

async function requireWorkspaceCategory(categoryId: string, workspaceId: string) {
  const category = await prisma.category.findFirst({
    where: {
      deletedAt: null,
      id: categoryId,
      workspaceId,
    },
    select: {
      id: true,
    },
  });

  if (!category) {
    redirect("/cards?error=missing-category");
  }

  return category;
}

async function requireWorkspaceStatement(
  statementId: string,
  creditCardId: string,
  workspaceId: string,
) {
  const statement = await prisma.creditCardStatement.findFirst({
    where: {
      creditCardId,
      deletedAt: null,
      id: statementId,
      workspaceId,
    },
    select: {
      id: true,
    },
  });

  if (!statement) {
    redirect("/cards?error=missing-statement");
  }

  return statement;
}

async function upsertStatementForPeriod(
  tx: TransactionClient,
  workspaceId: string,
  card: { closingDay: number; dueDay: number; id: string; name: string },
  period: StatementPeriod,
) {
  const dates = getStatementDates(period, card.closingDay, card.dueDay);
  const statement = await tx.creditCardStatement.upsert({
    where: {
      creditCardId_periodYear_periodMonth: {
        creditCardId: card.id,
        periodMonth: period.month,
        periodYear: period.year,
      },
    },
    create: {
      closingDate: dates.closingDate,
      creditCardId: card.id,
      dueDate: dates.dueDate,
      periodMonth: period.month,
      periodYear: period.year,
      totalAmount: 0,
      workspaceId,
    },
    update: {
      closingDate: dates.closingDate,
      dueDate: dates.dueDate,
    },
  });

  await ensureStatementReminder(tx, workspaceId, card.name, statement.id, statement.dueDate);

  return statement;
}

async function ensureStatementReminder(
  tx: TransactionClient,
  workspaceId: string,
  cardName: string,
  statementId: string,
  dueAt: Date,
) {
  const existingReminder = await tx.reminder.findFirst({
    where: {
      creditCardStatementId: statementId,
      deletedAt: null,
      workspaceId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  const title = `Vence ${cardName}`;
  const description = "Recordatorio del vencimiento del resumen de tarjeta.";

  if (existingReminder) {
    await tx.reminder.update({
      where: {
        id: existingReminder.id,
      },
      data: {
        description,
        dueAt,
        status: existingReminder.status === "DONE" ? "DONE" : "PENDING",
        title,
      },
    });

    return;
  }

  await tx.reminder.create({
    data: {
      creditCardStatementId: statementId,
      description,
      dueAt,
      title,
      workspaceId,
    },
  });
}

async function refreshStatementStatus(tx: TransactionClient, statementId: string) {
  const statement = await tx.creditCardStatement.findFirst({
    where: {
      deletedAt: null,
      id: statementId,
    },
    include: {
      installments: {
        where: {
          deletedAt: null,
          status: {
            not: "CANCELED",
          },
        },
        select: {
          amount: true,
        },
      },
      payments: {
        where: {
          deletedAt: null,
        },
        select: {
          amount: true,
        },
      },
    },
  });

  if (!statement) {
    return;
  }

  const totalAmount = statement.installments.reduce(
    (total, installment) => total + Number(installment.amount),
    0,
  );
  const paidAmount = statement.payments.reduce(
    (total, payment) => total + Number(payment.amount),
    0,
  );
  const status = getStatementStatus(
    totalAmount,
    paidAmount,
    statement.closingDate,
    statement.dueDate,
  );

  await tx.creditCardStatement.update({
    where: {
      id: statement.id,
    },
    data: {
      status,
      totalAmount,
    },
  });

  if (status === "PAID") {
    await tx.reminder.updateMany({
      where: {
        creditCardStatementId: statement.id,
        deletedAt: null,
        status: {
          not: "DONE",
        },
      },
      data: {
        completedAt: new Date(),
        status: "DONE",
      },
    });
  }
}
