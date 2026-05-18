"use server";

import { redirect } from "next/navigation";

import {
  budgetSchema,
  recurringRuleSchema,
  reminderSchema,
  subscriptionSchema,
} from "@/features/planning/schemas";
import { requireActiveWorkspace } from "@/features/workspaces/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function createRecurringRuleAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const parsedInput = recurringRuleSchema.safeParse({
    accountId: formData.get("accountId"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId"),
    dayOfMonth: formData.get("dayOfMonth"),
    description: formData.get("description"),
    frequency: formData.get("frequency"),
    startAt: formData.get("startAt"),
    type: formData.get("type"),
  });

  if (!parsedInput.success) {
    redirect("/planning?error=invalid-recurring-rule");
  }

  if (parsedInput.data.accountId) {
    await requireWorkspaceAccount(parsedInput.data.accountId, activeWorkspace.workspace.id);
  }

  if (parsedInput.data.categoryId) {
    await requireWorkspaceCategory(parsedInput.data.categoryId, activeWorkspace.workspace.id);
  }

  await prisma.recurringRule.create({
    data: {
      amount: parsedInput.data.amount,
      autoCreateTransaction: false,
      categoryId: parsedInput.data.categoryId,
      createdById: user.id,
      currency: activeWorkspace.workspace.baseCurrency,
      dayOfMonth:
        parsedInput.data.dayOfMonth ??
        (parsedInput.data.frequency === "MONTHLY"
          ? parsedInput.data.startAt.getDate()
          : null),
      description: parsedInput.data.description,
      destinationAccountId:
        parsedInput.data.type === "INCOME" ? parsedInput.data.accountId : null,
      frequency: parsedInput.data.frequency,
      nextRunAt: parsedInput.data.startAt,
      sourceAccountId:
        parsedInput.data.type === "EXPENSE" ? parsedInput.data.accountId : null,
      startAt: parsedInput.data.startAt,
      status: "ACTIVE",
      type: parsedInput.data.type,
      workspaceId: activeWorkspace.workspace.id,
    },
  });

  redirect("/planning");
}

export async function deleteRecurringRuleAction(ruleId: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();

  await prisma.recurringRule.updateMany({
    where: {
      deletedAt: null,
      id: ruleId,
      workspaceId: activeWorkspace.workspace.id,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  redirect("/planning");
}

export async function createSubscriptionAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const parsedInput = subscriptionSchema.safeParse({
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId"),
    creditCardId: formData.get("creditCardId"),
    frequency: formData.get("frequency"),
    name: formData.get("name"),
    nextBillingAt: formData.get("nextBillingAt"),
    provider: formData.get("provider"),
    sourceAccountId: formData.get("sourceAccountId"),
  });

  if (!parsedInput.success) {
    redirect("/planning?error=invalid-subscription");
  }

  if (parsedInput.data.sourceAccountId) {
    await requireWorkspaceAccount(parsedInput.data.sourceAccountId, activeWorkspace.workspace.id);
  }

  if (parsedInput.data.creditCardId) {
    await requireWorkspaceCreditCard(
      parsedInput.data.creditCardId,
      activeWorkspace.workspace.id,
    );
  }

  if (parsedInput.data.categoryId) {
    await requireWorkspaceCategory(parsedInput.data.categoryId, activeWorkspace.workspace.id);
  }

  await prisma.subscription.create({
    data: {
      amount: parsedInput.data.amount,
      categoryId: parsedInput.data.categoryId,
      createdById: user.id,
      creditCardId: parsedInput.data.creditCardId,
      currency: activeWorkspace.workspace.baseCurrency,
      frequency: parsedInput.data.frequency,
      name: parsedInput.data.name,
      nextBillingAt: parsedInput.data.nextBillingAt,
      provider: parsedInput.data.provider,
      sourceAccountId: parsedInput.data.sourceAccountId,
      status: "ACTIVE",
      workspaceId: activeWorkspace.workspace.id,
    },
  });

  redirect("/planning");
}

export async function deleteSubscriptionAction(subscriptionId: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();

  await prisma.subscription.updateMany({
    where: {
      deletedAt: null,
      id: subscriptionId,
      workspaceId: activeWorkspace.workspace.id,
    },
    data: {
      deletedAt: new Date(),
      status: "ENDED",
    },
  });

  redirect("/planning");
}

export async function createBudgetAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const parsedInput = budgetSchema.safeParse({
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId"),
    endsAt: formData.get("endsAt"),
    name: formData.get("name"),
    startsAt: formData.get("startsAt"),
  });

  if (!parsedInput.success) {
    redirect("/planning?error=invalid-budget");
  }

  if (parsedInput.data.categoryId) {
    await requireWorkspaceCategory(parsedInput.data.categoryId, activeWorkspace.workspace.id);
  }

  await prisma.budget.create({
    data: {
      amount: parsedInput.data.amount,
      categoryId: parsedInput.data.categoryId,
      createdById: user.id,
      currency: activeWorkspace.workspace.baseCurrency,
      endsAt: parsedInput.data.endsAt,
      name: parsedInput.data.name,
      period: "MONTHLY",
      startsAt: parsedInput.data.startsAt,
      workspaceId: activeWorkspace.workspace.id,
    },
  });

  redirect("/planning");
}

export async function deleteBudgetAction(budgetId: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();

  await prisma.budget.updateMany({
    where: {
      deletedAt: null,
      id: budgetId,
      workspaceId: activeWorkspace.workspace.id,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  redirect("/planning");
}

export async function createReminderAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const parsedInput = reminderSchema.safeParse({
    description: formData.get("description"),
    dueAt: formData.get("dueAt"),
    title: formData.get("title"),
  });

  if (!parsedInput.success) {
    redirect("/planning?error=invalid-reminder");
  }

  await prisma.reminder.create({
    data: {
      createdById: user.id,
      description: parsedInput.data.description,
      dueAt: parsedInput.data.dueAt,
      status: "PENDING",
      title: parsedInput.data.title,
      workspaceId: activeWorkspace.workspace.id,
    },
  });

  redirect("/planning");
}

export async function completeReminderAction(reminderId: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();

  await prisma.reminder.updateMany({
    where: {
      deletedAt: null,
      id: reminderId,
      workspaceId: activeWorkspace.workspace.id,
    },
    data: {
      completedAt: new Date(),
      status: "DONE",
    },
  });

  redirect("/planning");
}

export async function deleteReminderAction(reminderId: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();

  await prisma.reminder.updateMany({
    where: {
      deletedAt: null,
      id: reminderId,
      workspaceId: activeWorkspace.workspace.id,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  redirect("/planning");
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
    redirect("/planning?error=missing-account");
  }
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
    redirect("/planning?error=missing-category");
  }
}

async function requireWorkspaceCreditCard(creditCardId: string, workspaceId: string) {
  const card = await prisma.creditCard.findFirst({
    where: {
      deletedAt: null,
      id: creditCardId,
      workspaceId,
    },
    select: {
      id: true,
    },
  });

  if (!card) {
    redirect("/planning?error=missing-card");
  }
}
