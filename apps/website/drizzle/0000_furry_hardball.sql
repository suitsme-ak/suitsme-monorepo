CREATE TABLE `store_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`items` text NOT NULL,
	`shipping` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`shipping_cents` integer NOT NULL,
	`tax_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`status` text NOT NULL,
	`transaction_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_idempotency` ON `store_orders` (`owner`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `order_transaction` ON `store_orders` (`transaction_id`);