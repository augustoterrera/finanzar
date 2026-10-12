import { db } from '@/db';
import { payment_methods, cards, people } from '@/db/schema';
import { eq } from 'drizzle-orm';
import MediosClient from './MediosClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Medios de Pago | Finanzar'
};

// This page reads live card/payment-method records from the database. Do not
// serve a prerendered snapshot after cards are added or edited.
export const dynamic = 'force-dynamic';

export default async function MediosPage() {
  const allPaymentMethods = await db
    .select({
      id: payment_methods.id,
      name: payment_methods.name,
      type: payment_methods.type,
      card_id: payment_methods.card_id,
      color: payment_methods.color,
      card_name: cards.name,
      card_color: cards.color,
      owner_person_id: cards.owner_person_id,
      owner_name: people.name,
      closing_day: cards.closing_day,
      due_day: cards.due_day
    })
    .from(payment_methods)
    .leftJoin(cards, eq(payment_methods.card_id, cards.id))
    .leftJoin(people, eq(cards.owner_person_id, people.id))
    .orderBy(payment_methods.created_at);

  const allCards = await db.select().from(cards).orderBy(cards.name);
  const allPeople = await db.select().from(people).orderBy(people.name);
  
  const ownersById = new Map(allPeople.map(person => [person.id, person.name]));
  const cardsWithOwner = allCards.map(card => ({ ...card, owner_name: ownersById.get(card.owner_person_id) ?? null }));
  return <MediosClient paymentMethods={allPaymentMethods} cards={cardsWithOwner} people={allPeople} />;
}
