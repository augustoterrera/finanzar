import { db } from '@/db';
import { payment_methods, cards } from '@/db/schema';
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
      card_color: cards.color
    })
    .from(payment_methods)
    .leftJoin(cards, eq(payment_methods.card_id, cards.id))
    .orderBy(payment_methods.created_at);

  const allCards = await db.select().from(cards).orderBy(cards.name);
  
  return <MediosClient paymentMethods={allPaymentMethods} cards={allCards} />;
}
