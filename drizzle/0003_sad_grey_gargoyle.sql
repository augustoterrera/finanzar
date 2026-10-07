ALTER TABLE `cards` ADD `color` text;--> statement-breakpoint
ALTER TABLE `payment_methods` ADD `color` text;--> statement-breakpoint
CREATE INDEX `transaction_splits_transaction_id_idx` ON `transaction_splits` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `transaction_splits_person_id_idx` ON `transaction_splits` (`person_id`);--> statement-breakpoint
CREATE INDEX `transactions_month_status_idx` ON `transactions` (`month`,`status`);--> statement-breakpoint
CREATE INDEX `transactions_payer_person_id_idx` ON `transactions` (`payer_person_id`);--> statement-breakpoint
CREATE INDEX `transactions_payment_method_id_idx` ON `transactions` (`payment_method_id`);