import { db } from '@/db';
import { people, payment_methods, cards } from '@/db/schema';
import { eq } from 'drizzle-orm';
import TransactionForm from '@/components/TransactionForm';

function parseMoneyToCents(value: string): number | null {
  const normalized = value.replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, decimal = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  
  const allPeople = await db.select().from(people).orderBy(people.name);
  const allPaymentMethods = await db
    .select({
      id: payment_methods.id,
      name: payment_methods.name,
      type: payment_methods.type,
      color: payment_methods.color,
      card_name: cards.name,
      card_color: cards.color,
      closing_day: cards.closing_day,
      due_day: cards.due_day
    })
    .from(payment_methods)
    .leftJoin(cards, eq(payment_methods.card_id, cards.id))
    .orderBy(payment_methods.name);

  // Smart Parser
  const q = params.q;
  let parsedDefaults = null;

  if (q) {
    let raw = q.trim();
    let amount = '';
    let description = '';
    let payment_method_id = '';
    let payer_person_id = '';
    let foundSplits: Array<{ person_id: string, amount: string | number }> = [];

    const amountMatch = raw.match(/^(\d+(?:[.,]\d+)?)/);
    if (amountMatch) {
      amount = amountMatch[1].replace(',', '.');
      raw = raw.replace(amountMatch[0], '').trim();
    }

    if (raw.toLowerCase().includes('tarjeta')) {
      const pm = allPaymentMethods.find(p => p.type === 'credit_card');
      if (pm) payment_method_id = pm.id;
      raw = raw.replace(/tarjeta/gi, '').trim();
    } else {
      const pm = allPaymentMethods.find(p => p.type !== 'credit_card');
      if (pm) payment_method_id = pm.id;
    }

    const splitRegex = /@(\w+)(?:=(\d+(?:[.,]\d+)?))?/g;
    let match;
    while ((match = splitRegex.exec(raw)) !== null) {
      const [fullMatch, nameRef, splitAmountStr] = match;
      const person = allPeople.find(p => p.name.toLowerCase().startsWith(nameRef.toLowerCase()) || p.name.toLowerCase().includes(nameRef.toLowerCase()));
      
      if (person) {
        foundSplits.push({
          person_id: person.id,
          amount: splitAmountStr ? splitAmountStr.replace(',', '.') : 0
        });
      }
      raw = raw.replace(fullMatch, '').trim();
    }

    description = raw.replace(/\s+/g, ' ').trim();

    const owner = allPeople.find(p => p.is_owner);
    if (owner) payer_person_id = owner.id;

    if (foundSplits.length === 0 && amount && owner) {
      foundSplits = [{ person_id: owner.id, amount }];
    }

    if (foundSplits.length > 0 && amount) {
      const totalCents = parseMoneyToCents(amount);
      const missingAmountSplits = foundSplits.filter((split) => Number(split.amount) === 0);
      const assignedCents = foundSplits
        .filter((split) => Number(split.amount) > 0)
        .reduce((total, split) => total + (parseMoneyToCents(String(split.amount)) ?? 0), 0);

      if (totalCents !== null && missingAmountSplits.length > 0 && assignedCents <= totalCents) {
        const remainingCents = totalCents - assignedCents;
        const centsPerSplit = Math.floor(remainingCents / missingAmountSplits.length);
        const residualCents = remainingCents % missingAmountSplits.length;

        missingAmountSplits.forEach((split, index) => {
          split.amount = (centsPerSplit + (index < residualCents ? 1 : 0)) / 100;
        });
      }
    }

    parsedDefaults = {
      amount,
      description,
      payment_method_id,
      payer_person_id,
      splits: foundSplits
    };
  }

  return (
    <TransactionForm 
      people={allPeople} 
      paymentMethods={allPaymentMethods} 
      parsedDefaults={parsedDefaults} 
    />
  );
}
