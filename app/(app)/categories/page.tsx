import { AppHeader } from "@/components/layout/app-header";
import { CategoryCreateCard } from "@/features/categories/components/category-create-card";
import { CategoryList } from "@/features/categories/components/category-list";
import { getCategoriesForActiveWorkspace } from "@/features/categories/queries";
import { requireActiveWorkspace } from "@/features/workspaces/queries";

export default async function CategoriesPage() {
  const activeWorkspace = await requireActiveWorkspace();
  const categories = await getCategoriesForActiveWorkspace();

  return (
    <main className="grid gap-6">
      <AppHeader
        title="Categorías"
        workspaceName={activeWorkspace.workspace.name}
      />

      <CategoryCreateCard />
      <CategoryList categories={categories} />
    </main>
  );
}
