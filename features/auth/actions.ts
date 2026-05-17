"use server";

import { hash } from "bcryptjs";
import { redirect } from "next/navigation";

import { signUpSchema, type SignUpState } from "@/features/auth/schemas";
import { prisma } from "@/lib/prisma";

export async function signUpAction(
  _previousState: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const parsedInput = signUpSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
  });

  if (!parsedInput.success) {
    return {
      fieldErrors: parsedInput.error.flatten().fieldErrors,
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: parsedInput.data.email,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    return {
      error: "Ya existe una cuenta con ese email.",
    };
  }

  const passwordHash = await hash(parsedInput.data.password, 12);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: parsedInput.data.email,
        name: parsedInput.data.name,
        passwordHash,
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        baseCurrency: "ARS",
        createdById: user.id,
        name: `${parsedInput.data.name} personal`,
        type: "PERSONAL",
      },
    });

    await tx.workspaceMember.create({
      data: {
        displayName: parsedInput.data.name,
        joinedAt: new Date(),
        role: "OWNER",
        userId: user.id,
        workspaceId: workspace.id,
      },
    });

    await tx.category.createMany({
      data: [
        {
          color: "#16a34a",
          icon: "Wallet",
          isSystem: true,
          name: "Sueldo",
          type: "INCOME",
          workspaceId: workspace.id,
          createdById: user.id,
        },
        {
          color: "#0ea5e9",
          icon: "BriefcaseBusiness",
          isSystem: true,
          name: "Proyecto",
          type: "INCOME",
          workspaceId: workspace.id,
          createdById: user.id,
        },
        {
          color: "#ef4444",
          icon: "ShoppingCart",
          isSystem: true,
          name: "Compras",
          type: "EXPENSE",
          workspaceId: workspace.id,
          createdById: user.id,
        },
        {
          color: "#f59e0b",
          icon: "Home",
          isSystem: true,
          name: "Hogar",
          type: "EXPENSE",
          workspaceId: workspace.id,
          createdById: user.id,
        },
        {
          color: "#8b5cf6",
          icon: "CreditCard",
          isSystem: true,
          name: "Tarjeta",
          type: "EXPENSE",
          workspaceId: workspace.id,
          createdById: user.id,
        },
      ],
    });
  });

  redirect("/sign-in?registered=1");
}
