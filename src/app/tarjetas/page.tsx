import { db } from '@/db';
import { cards, people } from '@/db/schema';
import { eq } from 'drizzle-orm';
import TarjetasClient from './TarjetasClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tarjetas | Finanzar'
};

export default async function TarjetasPage() {
  const allCards = await db
    .select({
      id: cards.id,
      name: cards.name,
      owner_person_id: cards.owner_person_id,
      color: cards.color,
      closing_day: cards.closing_day,
      due_day: cards.due_day,
      owner_name: people.name
    })
    .from(cards)
    .leftJoin(people, eq(cards.owner_person_id, people.id))
    .orderBy(cards.created_at);

  const allPeople = await db.select().from(people).orderBy(people.name);
  
  return <TarjetasClient cards={allCards} people={allPeople} />;
}
