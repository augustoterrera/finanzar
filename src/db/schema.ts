import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const timestamps = {
	created_at: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
	updated_at: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`)
};

export const people = sqliteTable('people', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	is_owner: integer('is_owner', { mode: 'boolean' }).notNull().default(false),
	created_at: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`)
});

export const cards = sqliteTable('cards', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	owner_person_id: text('owner_person_id').notNull().references(() => people.id),
	color: text('color'),
	closing_day: integer('closing_day'),
	due_day: integer('due_day'),
	created_at: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`)
});

export const payment_methods = sqliteTable('payment_methods', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	type: text('type', { enum: ['cash', 'debit', 'transfer', 'credit_card'] }).notNull(),
	card_id: text('card_id').references(() => cards.id),
	color: text('color'),
	created_at: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`)
});

export const installment_groups = sqliteTable('installment_groups', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	description: text('description').notNull(),
	total_amount: integer('total_amount').notNull(),
	installments_total: integer('installments_total').notNull(),
	start_month: text('start_month').notNull(),
	created_at: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`)
});

export const recurring_rules = sqliteTable('recurring_rules', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	description: text('description').notNull(),
	amount: integer('amount').notNull(),
	type: text('type', { enum: ['income', 'expense'] }).notNull(),
	payer_person_id: text('payer_person_id').notNull().references(() => people.id),
	payment_method_id: text('payment_method_id').notNull().references(() => payment_methods.id),
	card_id: text('card_id').references(() => cards.id),
	frequency: text('frequency').notNull().default('monthly'),
	day_of_month: integer('day_of_month').notNull(),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	created_at: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`)
});

export const transactions = sqliteTable('transactions', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	date: text('date').notNull(),
	month: text('month').notNull(),
	type: text('type', { enum: ['income', 'expense'] }).notNull(),
	amount: integer('amount').notNull(),
	description: text('description').notNull(),
	payer_person_id: text('payer_person_id').notNull().references(() => people.id),
	payment_method_id: text('payment_method_id').notNull().references(() => payment_methods.id),
	card_id: text('card_id').references(() => cards.id),
	installment_group_id: text('installment_group_id').references(() => installment_groups.id),
	recurring_rule_id: text('recurring_rule_id').references(() => recurring_rules.id),
	status: text('status', { enum: ['active', 'void'] }).notNull().default('active'),
	notes: text('notes'),
	...timestamps
}, (table) => [
	uniqueIndex('transactions_recurring_rule_month_unique')
		.on(table.recurring_rule_id, table.month)
		.where(sql`${table.recurring_rule_id} IS NOT NULL`),
	index('transactions_month_status_idx').on(table.month, table.status),
	index('transactions_payer_person_id_idx').on(table.payer_person_id),
	index('transactions_payment_method_id_idx').on(table.payment_method_id)
]);

export const transaction_splits = sqliteTable('transaction_splits', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	transaction_id: text('transaction_id').notNull().references(() => transactions.id),
	person_id: text('person_id').notNull().references(() => people.id),
	amount: integer('amount').notNull(),
	created_at: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`)
}, (table) => [
	index('transaction_splits_transaction_id_idx').on(table.transaction_id),
	index('transaction_splits_person_id_idx').on(table.person_id)
]);
