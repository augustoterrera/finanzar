import { AppHeader } from "@/components/layout/app-header";
import { PlanningDashboard } from "@/features/planning/components/planning-dashboard";
import { getPlanningPageData } from "@/features/planning/queries";

export default async function PlanningPage() {
  const {
    accounts,
    budgets,
    cards,
    cashflow,
    categories,
    reminders,
    recurringRules,
    subscriptions,
    workspace,
  } = await getPlanningPageData();

  return (
    <main className="grid gap-6">
      <AppHeader
        subtitle="Organizá gastos, ingresos y vencimientos antes de que pasen."
        title="Planificación"
        workspaceName={workspace.name}
      />
      <PlanningDashboard
        accounts={accounts}
        budgets={budgets}
        cards={cards}
        cashflow={cashflow}
        categories={categories}
        reminders={reminders}
        recurringRules={recurringRules}
        subscriptions={subscriptions}
      />
    </main>
  );
}
