import { AppHeader } from "@/components/layout/app-header";
import { CardsDashboard } from "@/features/cards/components/cards-dashboard";
import { getCardsPageData } from "@/features/cards/queries";

export default async function CardsPage() {
  const { accounts, cards, categories, forecast, workspace } =
    await getCardsPageData();

  return (
    <main className="grid gap-6">
      <AppHeader title="Tarjetas" workspaceName={workspace.name} />
      <CardsDashboard
        accounts={accounts}
        cards={cards}
        categories={categories}
        forecast={forecast}
      />
    </main>
  );
}
