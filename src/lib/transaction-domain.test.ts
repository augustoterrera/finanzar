import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildInstallmentSchedule, isValidISODate, isValidYearMonth, parseMoneyToCents, parseSplitToCents } from './transaction-domain';

test('parses Argentine peso formats into integer cents', () => {
  assert.equal(parseMoneyToCents('200.000,50'), 20_000_050);
  assert.equal(parseMoneyToCents('200.000'), 20_000_000);
  assert.equal(parseMoneyToCents('1348,25'), 134_825);
  assert.equal(parseMoneyToCents('12.34'), 1_234);
  assert.equal(parseMoneyToCents('0'), null);
  assert.equal(parseMoneyToCents('1,234'), null);
  assert.equal(parseSplitToCents(13.48), 1_348);
  assert.equal(parseSplitToCents('13.48'), 1_348);
  assert.equal(parseSplitToCents('0.00'), 0);
  assert.equal(parseSplitToCents(13.489), null);
});

test('validates calendar dates and billing months rather than only their shape', () => {
  assert.equal(isValidISODate('2026-02-28'), true);
  assert.equal(isValidISODate('2026-02-30'), false);
  assert.equal(isValidYearMonth('2026-10'), true);
  assert.equal(isValidYearMonth('2026-13'), false);
});

test('builds remaining installments from the supplied installment and preserves split cents', () => {
  const schedule = buildInstallmentSchedule({
    splits: [{ person_id: 'leo', amount: 10_000 }, { person_id: 'euge', amount: 10_000 }],
    installmentsTotal: 3,
    startingInstallment: 2,
    billingMonth: '2026-12',
    dateDay: 28,
    dueDay: 31,
  });

  assert.deepEqual(schedule.map(({ installmentNumber, month, date, amount }) => ({ installmentNumber, month, date, amount })), [
    { installmentNumber: 2, month: '2026-12', date: '2026-12-31', amount: 6_666 },
    { installmentNumber: 3, month: '2027-01', date: '2027-01-31', amount: 6_668 },
  ]);
  assert.deepEqual(schedule.map((item) => item.splits.reduce((sum, split) => sum + split.amount, 0)), schedule.map((item) => item.amount));
  assert.equal(schedule.reduce((sum, item) => sum + item.amount, 0), 13_334);
});

test('clamps dates to month end and rejects invalid installment scope', () => {
  const schedule = buildInstallmentSchedule({
    splits: [{ person_id: 'owner', amount: 10_001 }],
    installmentsTotal: 3,
    startingInstallment: 1,
    billingMonth: '2026-01',
    dateDay: 31,
  });
  assert.deepEqual(schedule.map((item) => item.date), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.equal(schedule.reduce((sum, item) => sum + item.amount, 0), 10_001);
  assert.throws(() => buildInstallmentSchedule({
    splits: [{ person_id: 'owner', amount: 100 }], installmentsTotal: 2, startingInstallment: 3,
    billingMonth: '2026-01', dateDay: 1,
  }), RangeError);
});
