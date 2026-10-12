import { and, eq } from 'drizzle-orm';
import type { db } from '@/db';
import { cards, ledger_accounts, payment_methods, people, transaction_splits, transactions } from '@/db/schema';
import { buildExpenseLedgers } from '@/lib/expense-ledgers';
import { isValidYearMonth } from '@/lib/transaction-domain';

/**
 * Canonical monthly financial read used by the web dashboard and MCP tools.
 * Callers must authenticate and authorize before invoking this data service.
 */
export async function assertPrivateLedgerOwner(database: typeof db, ownerUserId: string) {
  const [ledgerOwner] = await database.select({ id: ledger_accounts.id })
    .from(ledger_accounts)
    .where(eq(ledger_accounts.owner_user_id, ownerUserId))
    .limit(1);
  if (!ledgerOwner || ledgerOwner.id !== 'private') throw new Error('El usuario no es titular del libro financiero');
}

export async function getFinanceContext(database: typeof db, ownerUserId: string) {
	await assertPrivateLedgerOwner(database, ownerUserId);
	const [allPeople, allCards, allPaymentMethods] = await Promise.all([
		database.select().from(people),
		database.select().from(cards),
		database.select().from(payment_methods),
	]);
	return {
		currency: 'ARS',
		unit: 'centavos',
		responsibilityModel: 'Los gastos se atribuyen por las divisiones; el pagador es un dato distinto.',
		people: allPeople,
		cards: allCards,
		paymentMethods: allPaymentMethods,
		capabilities: [
			'finanzar_get_month_summary',
			'finanzar_get_spending_summary',
			'finanzar_get_card_statement',
			'finanzar_list_transactions',
			'finanzar_search_transactions',
			'finanzar_audit_data_integrity',
			'finanzar_get_transaction',
			'finanzar_get_installment_group',
			'finanzar_list_recurring_rules',
			'finanzar_get_context',
			'finanzar_propose_create_transaction',
			'finanzar_propose_update_transaction',
			'finanzar_propose_update_installment_group',
			'finanzar_apply_confirmed_change',
			'finanzar_get_change_request',
			'finanzar_cancel_change_request',
		],
	};
}

export async function getMonthlyExpenseLedgerSnapshot(database: typeof db, ownerUserId: string, month: string) {
  if (!isValidYearMonth(month)) throw new RangeError('El mes debe tener formato AAAA-MM válido');
  await assertPrivateLedgerOwner(database, ownerUserId);

  const [allPeople, allCards, txRows] = await Promise.all([
    database.select().from(people),
    database.select().from(cards),
    database
      .select({ tx: transactions, split: transaction_splits })
      .from(transactions)
      .leftJoin(transaction_splits, eq(transactions.id, transaction_splits.transaction_id))
      .where(and(eq(transactions.month, month), eq(transactions.status, 'active'))),
  ]);

  const transactionsById = new Map<string, typeof transactions.$inferSelect>();
  const splits: typeof transaction_splits.$inferSelect[] = [];
  for (const row of txRows) {
    transactionsById.set(row.tx.id, row.tx);
    if (row.split) splits.push(row.split);
  }

  const monthTransactions = Array.from(transactionsById.values());
  const owner = allPeople.find((person) => person.is_owner) ?? null;
  const income = monthTransactions.reduce((total, transaction) =>
    total + (transaction.type === 'income' ? transaction.amount : 0), 0);
  const expenseIds = new Set(monthTransactions
    .filter((transaction) => transaction.type === 'expense')
    .map((transaction) => transaction.id));
  const ownerExpenses = owner
    ? splits.reduce((total, split) => total + (split.person_id === owner.id && expenseIds.has(split.transaction_id) ? split.amount : 0), 0)
    : 0;

  return {
    month,
    people: allPeople,
    cards: allCards,
    transactions: monthTransactions,
    splits,
    owner,
    income,
    ownerExpenses,
    ledgers: buildExpenseLedgers(monthTransactions, splits, allPeople, allCards),
  };
}
