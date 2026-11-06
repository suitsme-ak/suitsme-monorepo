CREATE TABLE `oauth_states` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`nonce_hash` text NOT NULL,
	`return_to` text,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL
);
