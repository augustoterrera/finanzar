import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildExpenseLedgers } from './expense-ledgers';

const people = [
  { id: 'owner', name: 'Augusto', is_owner: true },
  { id: 'leo', name: 'Leo', is_owner: false },
];
const cards = [
  { id: 'naranja', name: 'Naranja', color: '#ea580c' },
  { id: 'icbc', name: 'ICBC', color: '#dc2626' },
];
const expense = (id: string, amount: number, card_id: string | null = 'naranja') => ({
  id, amount, card_id, type: 'expense' as const, description: `${id} (Cuota 2/3)`, date: '2026-10-10',
});

test('separates responsible people and cards, without duplicating shared purchases', () => {
  const ledgers = buildExpenseLedgers([expense('shared', 888867), expense('other-card', 134825, 'icbc')], [
    { transaction_id: 'shared', person_id: 'owner', amount: 444434 },
    { transaction_id: 'shared', person_id: 'leo', amount: 444433 },
    { transaction_id: 'other-card', person_id: 'owner', amount: 134825 },
  ], people, cards);
  assert.equal(ledgers.length, 3);
  assert.equal(ledgers.reduce((total, ledger) => total + ledger.total, 0), 1023692);
  assert.equal(ledgers.find((ledger) => ledger.personId === 'leo')?.total, 444433);
  assert.equal(ledgers.find((ledger) => ledger.cardName === 'ICBC')?.total, 134825);
  assert.equal(ledgers.find((ledger) => ledger.personId === 'leo')?.items[0].shared, true);
  assert.equal(ledgers[0].isOwner, true);
});

test('keeps expenses without a card or responsible person visible and excludes income', () => {
  const ledgers = buildExpenseLedgers([
    expense('unassigned', 10000, null),
    expense('partial', 20000),
    { ...expense('income', 90000), type: 'income' },
  ], [{ transaction_id: 'partial', person_id: 'leo', amount: 15000 }], people, cards);
  assert.equal(ledgers.reduce((total, ledger) => total + ledger.total, 0), 30000);
  assert.equal(ledgers.find((ledger) => ledger.cardName === 'Sin tarjeta')?.personName, 'Sin responsable');
  assert.equal(ledgers.find((ledger) => ledger.cardName === 'Naranja' && ledger.personId === null)?.total, 5000);
});

test('combines split rows for the same person into one expense line and totals every line', () => {
  const ledgers = buildExpenseLedgers([expense('one', 10000), expense('two', 5000)], [
    { transaction_id: 'one', person_id: 'leo', amount: 6000 },
    { transaction_id: 'one', person_id: 'leo', amount: 4000 },
    { transaction_id: 'two', person_id: 'leo', amount: 5000 },
  ], people, cards);
  assert.equal(ledgers.length, 1);
  assert.equal(ledgers[0].items.length, 2);
  assert.equal(ledgers[0].total, 15000);
  assert.equal(ledgers[0].items[0].shared, false);
});

test('an empty month has no expense ledgers', () => {
  assert.deepEqual(buildExpenseLedgers([], [], people, cards), []);
});
