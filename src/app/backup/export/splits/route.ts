import { db } from '@/db';
import { transactions, transaction_splits, people } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { toCsv } from '@/lib/csv';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const splitsData = await db
      .select({
        split_id: transaction_splits.id,
        transaction_id: transactions.id,
        date: transactions.date,
        tx_description: transactions.description,
        person_name: people.name,
        amount: transaction_splits.amount
      })
      .from(transaction_splits)
      .leftJoin(transactions, eq(transaction_splits.transaction_id, transactions.id))
      .leftJoin(people, eq(transaction_splits.person_id, people.id))
      .orderBy(transactions.date);

    const header = ['Split ID', 'Transaction ID', 'Date', 'Transaction Description', 'Person', 'Amount'];
    const rows = splitsData.map(s => [
      s.split_id,
      s.transaction_id,
      s.date,
      s.tx_description,
      s.person_name,
      ((s.amount || 0) / 100).toFixed(2)
    ]);

    const csvContent = toCsv(header, rows);

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="finanzar_splits_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Error generating splits CSV:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
