"use server";

import { redirect } from "next/navigation";

import { transactionSchema } from "@/features/transactions/schemas";
import { requireActiveWorkspace } from "@/features/workspaces/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function getTransactionAccountData(type: "INCOME" | "EXPENSE", accountId: string) {
  if (type === "INCOME") {
    return {
      fromAccountId: null,
      toAccountId: accountId,
    };
  }

  return {
    fromAccountId: accountId,
    toAccountId: null,
  };
}

export async function createTransactionAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const parsedInput = transactionSchema.safeParse({
    accountId: formData.get("accountId"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId"),
    description: formData.get("description"),
    occurredAt: formData.get("occurredAt"),
    type: formData.get("type"),
  });

  if (!parsedInput.success) {
    redirect("/transactions?error=invalid-transaction");
  }

  const account = await prisma.financialAccount.findFirst({
    where: {
      deletedAt: null,
      id: parsedInput.data.accountId,
      workspaceId: activeWorkspace.workspace.id,
    },
    select: {
      currency: true,
      id: true,
    },
  });

  if (!account) {
    redirect("/transactions?error=missing-account");
  }

  await prisma.transaction.create({
    data: {
      ...getTransactionAccountData(parsedInput.data.type, account.id),
      amount: parsedInput.data.amount,
      categoryId: parsedInput.data.categoryId || null,
      createdById: user.id,
      currency: account.currency,
      description: parsedInput.data.description,
      occurredAt: parsedInput.data.occurredAt,
      status: "CLEARED",
      type: parsedInput.data.type,
      workspaceId: activeWorkspace.workspace.id,
    },
  });

  redirect("/transactions");
}

export async function updateTransactionAction(
  transactionId: string,
  formData: FormData,
) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const parsedInput = transactionSchema.safeParse({
    accountId: formData.get("accountId"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId"),
    description: formData.get("description"),
    occurredAt: formData.get("occurredAt"),
    type: formData.get("type"),
  });

  if (!parsedInput.success) {
    redirect("/transactions?error=invalid-transaction");
  }

  const account = await prisma.financialAccount.findFirst({
    where: {
      deletedAt: null,
      id: parsedInput.data.accountId,
      workspaceId: activeWorkspace.workspace.id,
    },
    select: {
      currency: true,
      id: true,
    },
  });

  if (!account) {
    redirect("/transactions?error=missing-account");
  }

  await prisma.transaction.updateMany({
    where: {
      deletedAt: null,
      id: transactionId,
      workspaceId: activeWorkspace.workspace.id,
    },
    data: {
      ...getTransactionAccountData(parsedInput.data.type, account.id),
      amount: parsedInput.data.amount,
      categoryId: parsedInput.data.categoryId || null,
      currency: account.currency,
      description: parsedInput.data.description,
      occurredAt: parsedInput.data.occurredAt,
      type: parsedInput.data.type,
    },
  });

  redirect("/transactions");
}

export async function deleteTransactionAction(transactionId: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();

  await prisma.transaction.updateMany({
    where: {
      deletedAt: null,
      id: transactionId,
      workspaceId: activeWorkspace.workspace.id,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  redirect("/transactions");
}
