import { sqliteTable, text, integer, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './auth-schema';

const timestamps = {
	created_at: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
	updated_at: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`)
};

/** The app's finance tables are a single private ledger, not per-person accounts. */
export const ledger_accounts = sqliteTable('ledger_accounts', {
	id: text('id').primaryKey().notNull().default('private'),
	owner_user_id: text('owner_user_id').notNull().unique().references(() => user.id, { onDelete: 'restrict' }),
	created_at: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => [check('ledger_accounts_private_singleton_check', sql`${table.id} = 'private'`)]);

/** Minimal revocation index for signed MCP JWTs, which Better Auth does not persist as token rows. */
export const mcp_access_grants = sqliteTable('mcp_access_grants', {
	jti: text('jti').primaryKey().notNull(),
	owner_user_id: text('owner_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	client_id: text('client_id').notNull(),
	issued_at: integer('issued_at', { mode: 'timestamp_ms' }).notNull(),
	expires_at: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
	revoked_at: integer('revoked_at', { mode: 'timestamp_ms' }),
}, (table) => [index('mcp_access_grants_owner_client_idx').on(table.owner_user_id, table.client_id)]);

/** Immutable, owner-reviewed change proposals created by external AI connections. */
export const ai_change_requests = sqliteTable('ai_change_requests', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	owner_user_id: text('owner_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
	client_id: text('client_id').notNull(),
	operation: text('operation').notNull(),
	payload_json: text('payload_json').notNull(),
	payload_hash: text('payload_hash').notNull(),
	preview_json: text('preview_json').notNull(),
	entity_versions_json: text('entity_versions_json').notNull().default('{}'),
	state: text('state', { enum: ['pending', 'applied', 'rejected', 'cancelled', 'expired', 'conflict'] }).notNull().default('pending'),
	expires_at: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
	approved_at: integer('approved_at', { mode: 'timestamp_ms' }),
	approved_by_user_id: text('approved_by_user_id').references(() => user.id, { onDelete: 'set null' }),
	result_json: text('result_json'),
	...timestamps,
}, (table) => [
	index('ai_change_requests_owner_state_created_idx').on(table.owner_user_id, table.state, table.created_at),
	index('ai_change_requests_owner_client_created_idx').on(table.owner_user_id, table.client_id, table.created_at),
]);

/** Durable idempotency namespace; a repeated key can never create a second proposal. */
export const ai_idempotency = sqliteTable('ai_idempotency', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	owner_user_id: text('owner_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
	client_id: text('client_id').notNull(),
	operation: text('operation').notNull(),
	idempotency_key: text('idempotency_key').notNull(),
	payload_hash: text('payload_hash').notNull(),
	change_request_id: text('change_request_id').notNull().references(() => ai_change_requests.id, { onDelete: 'restrict' }),
	created_at: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => [
	uniqueIndex('ai_idempotency_scope_key_uidx').on(table.owner_user_id, table.client_id, table.operation, table.idempotency_key),
	index('ai_idempotency_change_request_idx').on(table.change_request_id),
]);

/** Append-only audit trail for proposal creation and future human decisions. */
export const ai_audit_events = sqliteTable('ai_audit_events', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	owner_user_id: text('owner_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
	change_request_id: text('change_request_id').references(() => ai_change_requests.id, { onDelete: 'restrict' }),
	actor_type: text('actor_type', { enum: ['ai_connection', 'owner', 'system'] }).notNull(),
	actor_id: text('actor_id'),
	event_type: text('event_type').notNull(),
	metadata_json: text('metadata_json').notNull().default('{}'),
	created_at: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
}, (table) => [
	index('ai_audit_events_owner_created_idx').on(table.owner_user_id, table.created_at),
	index('ai_audit_events_change_request_idx').on(table.change_request_id),
]);

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
