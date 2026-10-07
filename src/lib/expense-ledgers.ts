type LedgerTransaction = {
  id: string;
  type: 'expense' | 'income';
  amount: number;
  description: string;
  date: string;
  card_id: string | null;
};

type LedgerSplit = { transaction_id: string; person_id: string; amount: number };
type LedgerPerson = { id: string; name: string; is_owner: boolean };
type LedgerCard = { id: string; name: string; color: string | null };

export type ExpenseLedger = {
  id: string;
  personId: string | null;
  personName: string;
  isOwner: boolean;
  cardName: string;
  cardColor: string | null;
  items: { id: string; description: string; amount: number; shared: boolean }[];
  total: number;
};

/** Group monthly expenses by responsibility, never by who paid the purchase. */
export function buildExpenseLedgers(
  transactions: LedgerTransaction[],
  splits: LedgerSplit[],
  people: LedgerPerson[],
  cards: LedgerCard[],
): ExpenseLedger[] {
  const personById = new Map(people.map((person) => [person.id, person]));
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const splitsByTransaction = new Map<string, LedgerSplit[]>();
  const ledgers = new Map<string, ExpenseLedger>();

  for (const split of splits) {
    const entries = splitsByTransaction.get(split.transaction_id) ?? [];
    entries.push(split);
    splitsByTransaction.set(split.transaction_id, entries);
  }

  const addItem = (transaction: LedgerTransaction, personId: string | null, amount: number, shared: boolean) => {
    const id = JSON.stringify([personId, transaction.card_id]);
    const person = personId ? personById.get(personId) : undefined;
    const card = transaction.card_id ? cardById.get(transaction.card_id) : undefined;
    let ledger = ledgers.get(id);

    if (!ledger) {
      ledger = {
        id,
        personId,
        personName: person?.name ?? 'Sin responsable',
        isOwner: person?.is_owner ?? false,
        cardName: card?.name ?? (transaction.card_id ? 'Tarjeta no encontrada' : 'Sin tarjeta'),
        cardColor: card?.color ?? null,
        items: [],
        total: 0,
      };
      ledgers.set(id, ledger);
    }

    ledger.items.push({ id: transaction.id, description: transaction.description, amount, shared });
    ledger.total += amount;
  };

  for (const transaction of [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    if (transaction.type !== 'expense') continue;
    const assigned = new Map<string, number>();
    for (const split of splitsByTransaction.get(transaction.id) ?? []) {
      assigned.set(split.person_id, (assigned.get(split.person_id) ?? 0) + split.amount);
    }

    const shared = assigned.size > 1;
    let assignedTotal = 0;
    for (const [personId, amount] of assigned) {
      assignedTotal += amount;
      addItem(transaction, personId, amount, shared);
    }

    // Keep missing allocations visible instead of silently attributing them to the payer.
    if (assignedTotal < transaction.amount) {
      addItem(transaction, null, transaction.amount - assignedTotal, shared || assigned.size > 0);
    }
  }

  return Array.from(ledgers.values()).sort((a, b) =>
    Number(b.isOwner) - Number(a.isOwner)
    || Number(a.personId === null) - Number(b.personId === null)
    || a.personName.localeCompare(b.personName, 'es')
    || a.cardName.localeCompare(b.cardName, 'es'),
  );
}
