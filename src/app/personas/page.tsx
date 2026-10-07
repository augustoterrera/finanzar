import { db } from '@/db';
import { people } from '@/db/schema';
import PersonasClient from './PersonasClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Personas | Finanzar'
};

export default async function PersonasPage() {
  const allPeople = await db.select().from(people).orderBy(people.created_at);
  return <PersonasClient people={allPeople} />;
}
