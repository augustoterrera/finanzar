import { db } from '@/db';
import { recurring_rules, people, payment_methods, cards } from '@/db/schema';
import { eq } from 'drizzle-orm';
import RecurrentesClient from './RecurrentesClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recurrentes | Finanzar'
};

// Reads live recurring rules; never serve a snapshot taken at build time.
export const dynamic = 'force-dynamic';

export default async function RecurrentesPage() {
  const allRules = await db
    .select({
      id: recurring_rules.id,
      description: recurring_rules.description,
      amount: recurring_rules.amount,
      type: recurring_rules.type,
      day_of_month: recurring_rules.day_of_month,
      active: recurring_rules.active,
      payer_name: people.name,
      payment_method_name: payment_methods.name
    })
    .from(recurring_rules)
    .leftJoin(people, eq(recurring_rules.payer_person_id, people.id))
    .leftJoin(payment_methods, eq(recurring_rules.payment_method_id, payment_methods.id))
    .orderBy(recurring_rules.day_of_month);

  const allPeople = await db.select().from(people).orderBy(people.name);
  
  const allPaymentMethods = await db
    .select({
      id: payment_methods.id,
      name: payment_methods.name,
      type: payment_methods.type,
      card_name: cards.name
    })
    .from(payment_methods)
    .leftJoin(cards, eq(payment_methods.card_id, cards.id))
    .orderBy(payment_methods.name);

  return <RecurrentesClient rules={allRules} people={allPeople} paymentMethods={allPaymentMethods} />;
}
