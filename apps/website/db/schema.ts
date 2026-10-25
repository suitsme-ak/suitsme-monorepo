import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const orders = sqliteTable('store_orders', {
 id: text('id').primaryKey(), owner: text('owner').notNull(), idempotencyKey: text('idempotency_key').notNull(),
 items: text('items').notNull(), shipping: text('shipping').notNull(), subtotalCents: integer('subtotal_cents').notNull(),
 shippingCents: integer('shipping_cents').notNull(), taxCents: integer('tax_cents').notNull(), totalCents: integer('total_cents').notNull(),
 status: text('status').notNull(), transactionId: text('transaction_id'), createdAt: text('created_at').notNull(),
},table=>[uniqueIndex('order_idempotency').on(table.owner,table.idempotencyKey),uniqueIndex('order_transaction').on(table.transactionId)]);
