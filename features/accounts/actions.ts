"use server";

import { redirect } from "next/navigation";

import {
  createAccountSchema,
  type CreateAccountState,
  updateAccountSchema,
} from "@/features/accounts/schemas";
import { requireActiveWorkspace } from "@/features/workspaces/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function createAccountAction(
  _previousState: CreateAccountState,
  formData: FormData,
): Promise<CreateAccountState> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const parsedInput = createAccountSchema.safeParse({
    currency: formData.get("currency"),
    name: formData.get("name"),
    openingBalance: formData.get("openingBalance"),
    type: formData.get("type"),
  });

  if (!parsedInput.success) {
    return {
      fieldErrors: parsedInput.error.flatten().fieldErrors,
    };
  }

  await prisma.financialAccount.create({
    data: {
      createdById: user.id,
      currency: parsedInput.data.currency,
      name: parsedInput.data.name,
      openingBalance: parsedInput.data.openingBalance,
      ownerMemberId: activeWorkspace.member.id,
      type: parsedInput.data.type,
      workspaceId: activeWorkspace.workspace.id,
    },
  });

  const redirectTo = formData.get("redirectTo");

  redirect(typeof redirectTo === "string" ? redirectTo : "/dashboard");
}

export async function createAccountFormAction(formData: FormData) {
  await createAccountAction({}, formData);
}

export async function updateAccountAction(accountId: string, formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const parsedInput = updateAccountSchema.safeParse({
    currency: formData.get("currency"),
    name: formData.get("name"),
    openingBalance: formData.get("openingBalance"),
    type: formData.get("type"),
  });

  if (!parsedInput.success) {
    redirect("/accounts?error=invalid-account");
  }

  await prisma.financialAccount.updateMany({
    where: {
      id: accountId,
      workspaceId: activeWorkspace.workspace.id,
    },
    data: {
      currency: parsedInput.data.currency,
      name: parsedInput.data.name,
      openingBalance: parsedInput.data.openingBalance,
      type: parsedInput.data.type,
    },
  });

  redirect("/accounts");
}

export async function deleteAccountAction(accountId: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();

  await prisma.financialAccount.updateMany({
    where: {
      id: accountId,
      workspaceId: activeWorkspace.workspace.id,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  redirect("/accounts");
}
