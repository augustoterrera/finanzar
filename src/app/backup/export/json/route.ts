import { db } from '@/db';
import { people, payment_methods, cards, recurring_rules, installment_groups, transactions, transaction_splits } from '@/db/schema';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const exportData = {
      version: 1,
      exportDate: new Date().toISOString(),
      data: {
        people: await db.select().from(people),
        cards: await db.select().from(cards),
        payment_methods: await db.select().from(payment_methods),
        recurring_rules: await db.select().from(recurring_rules),
        installment_groups: await db.select().from(installment_groups),
        transactions: await db.select().from(transactions),
        transaction_splits: await db.select().from(transaction_splits)
      }
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="finanzar_backup_${new Date().toISOString().split('T')[0]}.json"`
      }
    });
  } catch (error) {
    console.error('Error generating JSON backup:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
