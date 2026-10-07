import { db } from '@/db';
import { transactions, transaction_splits, people, cards, payment_methods } from '@/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import MovimientosClient from './MovimientosClient';
import { MovementItem } from '@/components/MovimientosList';

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const currentMonth = new Date().toISOString().substring(0, 7);

  // Si no se especifica mes en la URL, abre por defecto el mes actual.
  // Si params.month === 'all', muestra todos los meses.
  const initialMonth = params.month !== undefined ? params.month : currentMonth;
  const isAllMonths = initialMonth === 'all';

  const whereClause = isAllMonths
    ? eq(transactions.status, 'active')
    : and(eq(transactions.status, 'active'), eq(transactions.month, initialMonth));

  // Consultas en paralelo optimizadas:
  // 1. Obtener meses únicos con movimientos activos (sin escanear todo el historial completo de columnas ni splits)
  // 2. Personas, tarjetas y métodos de pago
  // 3. Transacciones y splits del mes seleccionado con leftJoin en una sola consulta
  const [distinctMonthsData, allPeople, allCards, allPaymentMethods, txData] = await Promise.all([
    db
      .selectDistinct({ month: transactions.month })
      .from(transactions)
      .where(eq(transactions.status, 'active')),
    db.select().from(people),
    db.select().from(cards),
    db.select().from(payment_methods),
    db
      .select({
        tx: transactions,
        split: transaction_splits,
      })
      .from(transactions)
      .leftJoin(transaction_splits, eq(transactions.id, transaction_splits.transaction_id))
      .where(whereClause)
      .orderBy(desc(transactions.date), desc(transactions.created_at)),
  ]);

  const owner = allPeople.find((p) => p.is_owner);

  // Extraer meses disponibles asegurando que el mes actual siempre esté en la lista
  const monthsSet = new Set<string>();
  monthsSet.add(currentMonth);
  for (const row of distinctMonthsData) {
    if (row.month) monthsSet.add(row.month);
  }
  const availableMonths = Array.from(monthsSet).sort().reverse();

  // Agrupar transacciones y sus splits
  const txsMap = new Map<string, typeof transactions.$inferSelect>();
  const splitsMap = new Map<string, (typeof transaction_splits.$inferSelect)[]>();

  for (const row of txData) {
    if (!txsMap.has(row.tx.id)) {
      txsMap.set(row.tx.id, row.tx);
    }
    if (row.split) {
      const list = splitsMap.get(row.tx.id) ?? [];
      list.push(row.split);
      splitsMap.set(row.tx.id, list);
    }
  }

  const txs = Array.from(txsMap.values());

  // Mapear a MovementItem
  const initialItems: MovementItem[] = txs.map((tx) => {
    const payer = allPeople.find((p) => p.id === tx.payer_person_id);
    const card = tx.card_id ? allCards.find((c) => c.id === tx.card_id) : null;
    const method = tx.payment_method_id
      ? allPaymentMethods.find((m) => m.id === tx.payment_method_id)
      : null;
    const txSplits = splitsMap.get(tx.id) ?? [];
    const hasSplits = txSplits.length > 1;
    const responsibleSplits = Array.from(
      txSplits.reduce((byPerson, split) => {
        const name = allPeople.find((person) => person.id === split.person_id)?.name;
        if (name) byPerson.set(name, (byPerson.get(name) ?? 0) + split.amount);
        return byPerson;
      }, new Map<string, number>()).entries(),
      ([name, amount]) => ({ name, amount })
    );
    const responsibleNames = responsibleSplits.map((split) => split.name);

    return {
      id: tx.id,
      date: tx.date,
      month: tx.month,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      payerName: payer ? payer.name : undefined,
      isOwnerPayer: owner ? tx.payer_person_id === owner.id : true,
      methodName: method?.name,
      methodColor: method?.color,
      cardName: card?.name,
      cardColor: card?.color,
      responsibleNames,
      responsibleSplits,
      hasSplits,
    };
  });

  return (
    <MovimientosClient
      initialItems={initialItems}
      availableMonths={availableMonths}
      defaultMonth={initialMonth}
      currentMonth={currentMonth}
    />
  );
}
