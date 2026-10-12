BEGIN;
CREATE INDEX IF NOT EXISTS `transaction_splits_transaction_id_idx` ON `transaction_splits` (`transaction_id`);
CREATE INDEX IF NOT EXISTS `transaction_splits_person_id_idx` ON `transaction_splits` (`person_id`);
CREATE INDEX IF NOT EXISTS `transactions_month_status_idx` ON `transactions` (`month`,`status`);
CREATE INDEX IF NOT EXISTS `transactions_payer_person_id_idx` ON `transactions` (`payer_person_id`);
CREATE INDEX IF NOT EXISTS `transactions_payment_method_id_idx` ON `transactions` (`payment_method_id`);
CREATE TABLE `jwks` (
	`id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`alg` text,
	`crv` text
);

CREATE TABLE `oauth_access_token` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`client_id` text NOT NULL,
	`session_id` text,
	`user_id` text,
	`reference_id` text,
	`authorization_code_id` text,
	`resources` text,
	`requested_user_info_claims` text,
	`refresh_id` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`revoked` integer,
	`confirmation` text,
	`scopes` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`refresh_id`) REFERENCES `oauth_refresh_token`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `oauth_access_token_token_unique` ON `oauth_access_token` (`token`);
CREATE INDEX `oauthAccessToken_clientId_idx` ON `oauth_access_token` (`client_id`);
CREATE INDEX `oauthAccessToken_sessionId_idx` ON `oauth_access_token` (`session_id`);
CREATE INDEX `oauthAccessToken_userId_idx` ON `oauth_access_token` (`user_id`);
CREATE INDEX `oauthAccessToken_authorizationCodeId_idx` ON `oauth_access_token` (`authorization_code_id`);
CREATE INDEX `oauthAccessToken_refreshId_idx` ON `oauth_access_token` (`refresh_id`);
CREATE TABLE `oauth_client` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text,
	`client_discovery_id` text,
	`disabled` integer DEFAULT false,
	`skip_consent` integer,
	`enable_end_session` integer,
	`subject_type` text,
	`scopes` text,
	`client_credentials_scopes` text DEFAULT '[]',
	`user_id` text,
	`created_at` integer,
	`updated_at` integer,
	`name` text,
	`uri` text,
	`icon` text,
	`contacts` text,
	`tos` text,
	`policy` text,
	`software_id` text,
	`software_version` text,
	`software_statement` text,
	`redirect_uris` text NOT NULL,
	`post_logout_redirect_uris` text,
	`backchannel_logout_uri` text,
	`backchannel_logout_session_required` integer,
	`token_endpoint_auth_method` text,
	`application_type` text,
	`jwks` text,
	`jwks_uri` text,
	`grant_types` text,
	`response_types` text,
	`require_pkce` integer,
	`dpop_bound_access_tokens` integer DEFAULT false,
	`reference_id` text,
	`metadata` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `oauth_client_client_id_unique` ON `oauth_client` (`client_id`);
CREATE INDEX `oauthClient_userId_idx` ON `oauth_client` (`user_id`);
CREATE TABLE `oauth_client_assertion` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);

CREATE TABLE `oauth_client_resource` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`metadata` text,
	`created_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `oauth_resource`(`identifier`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `oauthClientResource_clientId_resourceId_uidx` ON `oauth_client_resource` (`client_id`,`resource_id`);
CREATE INDEX `oauthClientResource_clientId_idx` ON `oauth_client_resource` (`client_id`);
CREATE INDEX `oauthClientResource_resourceId_idx` ON `oauth_client_resource` (`resource_id`);
CREATE TABLE `oauth_consent` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text,
	`reference_id` text,
	`resources` text,
	`requested_user_info_claims` text,
	`scopes` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `oauthConsent_clientId_idx` ON `oauth_consent` (`client_id`);
CREATE INDEX `oauthConsent_userId_idx` ON `oauth_consent` (`user_id`);
CREATE TABLE `oauth_refresh_token` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`client_id` text NOT NULL,
	`session_id` text,
	`user_id` text NOT NULL,
	`reference_id` text,
	`authorization_code_id` text,
	`resources` text,
	`requested_user_info_claims` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`revoked` integer,
	`rotated_at` integer,
	`rotation_replay_response` text,
	`rotation_replay_expires_at` integer,
	`auth_time` integer,
	`confirmation` text,
	`scopes` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `oauth_refresh_token_token_unique` ON `oauth_refresh_token` (`token`);
CREATE INDEX `oauthRefreshToken_clientId_idx` ON `oauth_refresh_token` (`client_id`);
CREATE INDEX `oauthRefreshToken_sessionId_idx` ON `oauth_refresh_token` (`session_id`);
CREATE INDEX `oauthRefreshToken_userId_idx` ON `oauth_refresh_token` (`user_id`);
CREATE INDEX `oauthRefreshToken_authorizationCodeId_idx` ON `oauth_refresh_token` (`authorization_code_id`);
CREATE TABLE `oauth_resource` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`name` text NOT NULL,
	`access_token_ttl` integer,
	`refresh_token_ttl` integer,
	`signing_algorithm` text,
	`signing_key_id` text,
	`allowed_scopes` text,
	`custom_claims` text,
	`dpop_bound_access_tokens_required` integer DEFAULT false,
	`disabled` integer DEFAULT false,
	`created_at` integer,
	`updated_at` integer,
	`policy_version` integer DEFAULT 1,
	`metadata` text
);

CREATE UNIQUE INDEX `oauth_resource_identifier_unique` ON `oauth_resource` (`identifier`);
CREATE TABLE `ledger_accounts` (
	`id` text PRIMARY KEY DEFAULT 'private' NOT NULL,
	`owner_user_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ledger_accounts_private_singleton_check" CHECK("ledger_accounts"."id" = 'private')
);

CREATE UNIQUE INDEX `ledger_accounts_owner_user_id_unique` ON `ledger_accounts` (`owner_user_id`);

-- Bind existing data only when there is exactly one authentication user. Zero or
-- multiple users deliberately leave the ledger unowned so every caller fails closed.
INSERT INTO `ledger_accounts` (`id`, `owner_user_id`)
SELECT 'private', `id` FROM `user`
WHERE (SELECT count(*) FROM `user`) = 1
LIMIT 1;

CREATE TABLE `mcp_access_grants` (
	`jti` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `mcp_access_grants_owner_client_idx` ON `mcp_access_grants` (`owner_user_id`,`client_id`);
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

CREATE INDEX `ai_audit_events_owner_created_idx` ON `ai_audit_events` (`owner_user_id`,`created_at`);
CREATE INDEX `ai_audit_events_change_request_idx` ON `ai_audit_events` (`change_request_id`);
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

CREATE INDEX `ai_change_requests_owner_state_created_idx` ON `ai_change_requests` (`owner_user_id`,`state`,`created_at`);
CREATE INDEX `ai_change_requests_owner_client_created_idx` ON `ai_change_requests` (`owner_user_id`,`client_id`,`created_at`);
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

CREATE UNIQUE INDEX `ai_idempotency_scope_key_uidx` ON `ai_idempotency` (`owner_user_id`,`client_id`,`operation`,`idempotency_key`);
CREATE INDEX `ai_idempotency_change_request_idx` ON `ai_idempotency` (`change_request_id`);
INSERT INTO __drizzle_migrations (hash, created_at) SELECT '2f4a28a30d75adf8ff7a0d546c961a5345bbc4be6030ca4d01094208504c3254', 1789606156497 WHERE NOT EXISTS (SELECT 1 FROM __drizzle_migrations WHERE hash = '2f4a28a30d75adf8ff7a0d546c961a5345bbc4be6030ca4d01094208504c3254');
INSERT INTO __drizzle_migrations (hash, created_at) SELECT 'dcb0b85e31fedeed03b3693ac671e6cbabb1cafcd42360b7c4c5085018b2187f', 1791343394158 WHERE NOT EXISTS (SELECT 1 FROM __drizzle_migrations WHERE hash = 'dcb0b85e31fedeed03b3693ac671e6cbabb1cafcd42360b7c4c5085018b2187f');
INSERT INTO __drizzle_migrations (hash, created_at) SELECT '18fca79812ee1185754a5fe0521809f71201aa009fa2e5731915aebfe39a46c2', 1791411659527 WHERE NOT EXISTS (SELECT 1 FROM __drizzle_migrations WHERE hash = '18fca79812ee1185754a5fe0521809f71201aa009fa2e5731915aebfe39a46c2');
INSERT INTO __drizzle_migrations (hash, created_at) SELECT '3c200d19ddace768a29a45f57b7ffdc539c403c4d781253c0b1b6484f29f7d5a', 1791412650561 WHERE NOT EXISTS (SELECT 1 FROM __drizzle_migrations WHERE hash = '3c200d19ddace768a29a45f57b7ffdc539c403c4d781253c0b1b6484f29f7d5a');
INSERT INTO __drizzle_migrations (hash, created_at) SELECT '3206d2408d94f11dc4124c3bcb113da4ca7d8fb01125f64e4ee7f264f1b5f983', 1791413191101 WHERE NOT EXISTS (SELECT 1 FROM __drizzle_migrations WHERE hash = '3206d2408d94f11dc4124c3bcb113da4ca7d8fb01125f64e4ee7f264f1b5f983');
INSERT INTO __drizzle_migrations (hash, created_at) SELECT 'e602a1629f1748bbd819bf05d1080f0ca39fadb08308a29d96f195af735b3239', 1791495944180 WHERE NOT EXISTS (SELECT 1 FROM __drizzle_migrations WHERE hash = 'e602a1629f1748bbd819bf05d1080f0ca39fadb08308a29d96f195af735b3239');
COMMIT;
