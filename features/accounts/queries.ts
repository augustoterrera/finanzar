import { requireActiveWorkspace } from "@/features/workspaces/queries";
import { prisma } from "@/lib/prisma";

export async function getAccountsForActiveWorkspace() {
  const activeWorkspace = await requireActiveWorkspace();

  return prisma.financialAccount.findMany({
    where: {
      deletedAt: null,
      workspaceId: activeWorkspace.workspace.id,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}
