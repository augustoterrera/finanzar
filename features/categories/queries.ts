import { requireActiveWorkspace } from "@/features/workspaces/queries";
import { prisma } from "@/lib/prisma";

export async function getCategoriesForActiveWorkspace() {
  const activeWorkspace = await requireActiveWorkspace();

  return prisma.category.findMany({
    where: {
      deletedAt: null,
      workspaceId: activeWorkspace.workspace.id,
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}
