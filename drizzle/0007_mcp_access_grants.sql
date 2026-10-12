CREATE TABLE `mcp_access_grants` (
	`jti` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mcp_access_grants_owner_client_idx` ON `mcp_access_grants` (`owner_user_id`,`client_id`);