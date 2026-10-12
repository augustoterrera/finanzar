CREATE TABLE `ledger_accounts` (
	`id` text PRIMARY KEY DEFAULT 'private' NOT NULL,
	`owner_user_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ledger_accounts_private_singleton_check" CHECK("ledger_accounts"."id" = 'private')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_accounts_owner_user_id_unique` ON `ledger_accounts` (`owner_user_id`);
--> statement-breakpoint
-- Bind existing data only when there is exactly one authentication user. Zero or
-- multiple users deliberately leave the ledger unowned so every caller fails closed.
INSERT INTO `ledger_accounts` (`id`, `owner_user_id`)
SELECT 'private', `id` FROM `user`
WHERE (SELECT count(*) FROM `user`) = 1
LIMIT 1;
