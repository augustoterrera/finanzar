import { db } from '@/db';
import { transactions, people, payment_methods, cards } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { toCsv } from '@/lib/csv';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const txs = await db
      .select({
        id: transactions.id,
        date: transactions.date,
        month: transactions.month,
        type: transactions.type,
        amount: transactions.amount,
        description: transactions.description,
        payer_name: people.name,
        payment_method_name: payment_methods.name,
        card_name: cards.name,
        status: transactions.status
      })
      .from(transactions)
      .leftJoin(people, eq(transactions.payer_person_id, people.id))
      .leftJoin(payment_methods, eq(transactions.payment_method_id, payment_methods.id))
      .leftJoin(cards, eq(transactions.card_id, cards.id))
      .orderBy(transactions.date);

    const header = ['ID', 'Date', 'Month', 'Type', 'Amount', 'Description', 'Payer', 'Payment Method', 'Card', 'Status'];
    const rows = txs.map(t => [
      t.id,
      t.date,
      t.month,
      t.type,
      (t.amount / 100).toFixed(2),
      t.description,
      t.payer_name,
      t.payment_method_name,
      t.card_name,
      t.status
    ]);

    const csvContent = toCsv(header, rows);

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="finanzar_transactions_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Error generating transactions CSV:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
