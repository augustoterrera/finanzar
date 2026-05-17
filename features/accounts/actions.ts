"use server";

import { redirect } from "next/navigation";

import {
  createAccountSchema,
  type CreateAccountState,
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

  redirect("/dashboard");
}
