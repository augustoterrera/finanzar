CREATE TABLE `ai_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`change_request_id` text,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`event_type` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`change_request_id`) REFERENCES `ai_change_requests`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `ai_audit_events_owner_created_idx` ON `ai_audit_events` (`owner_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_audit_events_change_request_idx` ON `ai_audit_events` (`change_request_id`);--> statement-breakpoint
CREATE TABLE `ai_change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`operation` text NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`preview_json` text NOT NULL,
	`entity_versions_json` text DEFAULT '{}' NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`approved_at` integer,
	`approved_by_user_id` text,
	`result_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ai_change_requests_owner_state_created_idx` ON `ai_change_requests` (`owner_user_id`,`state`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_change_requests_owner_client_created_idx` ON `ai_change_requests` (`owner_user_id`,`client_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_idempotency` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`operation` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`payload_hash` text NOT NULL,
	`change_request_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`change_request_id`) REFERENCES `ai_change_requests`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_idempotency_scope_key_uidx` ON `ai_idempotency` (`owner_user_id`,`client_id`,`operation`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `ai_idempotency_change_request_idx` ON `ai_idempotency` (`change_request_id`);