"use server";

import { redirect } from "next/navigation";

import { workspaceSettingsSchema } from "@/features/workspaces/schemas";
import { requireActiveWorkspace } from "@/features/workspaces/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function updateWorkspaceSettingsAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const parsedInput = workspaceSettingsSchema.safeParse({
    baseCurrency: formData.get("baseCurrency"),
    name: formData.get("name"),
    type: formData.get("type"),
  });

  if (!parsedInput.success) {
    redirect("/settings?error=invalid-workspace");
  }

  await prisma.workspace.update({
    where: {
      id: activeWorkspace.workspace.id,
    },
    data: {
      baseCurrency: parsedInput.data.baseCurrency,
      name: parsedInput.data.name,
      type: parsedInput.data.type,
    },
  });

  redirect("/settings");
}
