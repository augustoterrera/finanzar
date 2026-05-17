import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const getActiveWorkspace = cache(async () => {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      userId: user.id,
      workspace: {
        deletedAt: null,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      workspace: {
        include: {
          _count: {
            select: {
              accounts: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!membership) {
    return null;
  }

  return {
    accountCount: membership.workspace._count.accounts,
    member: {
      id: membership.id,
      role: membership.role,
    },
    workspace: {
      baseCurrency: membership.workspace.baseCurrency,
      id: membership.workspace.id,
      name: membership.workspace.name,
      type: membership.workspace.type,
    },
  };
});

export async function requireActiveWorkspace() {
  const activeWorkspace = await getActiveWorkspace();

  if (!activeWorkspace) {
    throw new Error("Active workspace not found.");
  }

  return activeWorkspace;
}
