"use server";

import { redirect } from "next/navigation";

import { categorySchema } from "@/features/categories/schemas";
import { requireActiveWorkspace } from "@/features/workspaces/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function createCategoryAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const parsedInput = categorySchema.safeParse({
    color: formData.get("color"),
    icon: formData.get("icon"),
    name: formData.get("name"),
    type: formData.get("type"),
  });

  if (!parsedInput.success) {
    redirect("/categories?error=invalid-category");
  }

  await prisma.category.create({
    data: {
      color: parsedInput.data.color || null,
      createdById: user.id,
      icon: parsedInput.data.icon || null,
      name: parsedInput.data.name,
      type: parsedInput.data.type,
      workspaceId: activeWorkspace.workspace.id,
    },
  });

  redirect("/categories");
}

export async function updateCategoryAction(categoryId: string, formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();
  const parsedInput = categorySchema.safeParse({
    color: formData.get("color"),
    icon: formData.get("icon"),
    name: formData.get("name"),
    type: formData.get("type"),
  });

  if (!parsedInput.success) {
    redirect("/categories?error=invalid-category");
  }

  await prisma.category.updateMany({
    where: {
      id: categoryId,
      workspaceId: activeWorkspace.workspace.id,
    },
    data: {
      color: parsedInput.data.color || null,
      icon: parsedInput.data.icon || null,
      name: parsedInput.data.name,
      type: parsedInput.data.type,
    },
  });

  redirect("/categories");
}

export async function deleteCategoryAction(categoryId: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await requireActiveWorkspace();

  await prisma.category.updateMany({
    where: {
      id: categoryId,
      workspaceId: activeWorkspace.workspace.id,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  redirect("/categories");
}
