import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';
export const orders = sqliteTable('store_orders', {
 id: text('id').primaryKey(), owner: text('owner').notNull(), idempotencyKey: text('idempotency_key').notNull(),
 items: text('items').notNull(), shipping: text('shipping').notNull(), subtotalCents: integer('subtotal_cents').notNull(),
 shippingCents: integer('shipping_cents').notNull(), taxCents: integer('tax_cents').notNull(), totalCents: integer('total_cents').notNull(),
 status: text('status').notNull(), transactionId: text('transaction_id'), createdAt: text('created_at').notNull(),
},table=>[uniqueIndex('order_idempotency').on(table.owner,table.idempotencyKey),uniqueIndex('order_transaction').on(table.transactionId)]);
// Wave 5 (Option B standalone accounts, docs/ux-audit/wave-5-design.md
// section 1). All tables are additive; store_orders above is not altered.
// Runtime access is raw D1 SQL in lib/accounts.ts, like lib/commerce.ts;
// this file stays the migration source of truth.
export const users = sqliteTable('users', {
 id: text('id').primaryKey(), email: text('email').notNull(), displayName: text('display_name'),
 emailVerifiedAt: text('email_verified_at'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
 deletedAt: text('deleted_at'),
},table=>[uniqueIndex('user_email').on(table.email)]);
export const userCredentials = sqliteTable('user_credentials', {
 userId: text('user_id').primaryKey(), passwordHash: text('password_hash').notNull(), passwordUpdatedAt: text('password_updated_at').notNull(),
});
export const userIdentities = sqliteTable('user_identities', {
 provider: text('provider').notNull(), subject: text('subject').notNull(), userId: text('user_id').notNull(),
 email: text('email'), createdAt: text('created_at').notNull(),
},table=>[primaryKey({columns:[table.provider,table.subject]}),index('identity_user').on(table.userId)]);
export const sessions = sqliteTable('sessions', {
 tokenHash: text('token_hash').primaryKey(), userId: text('user_id').notNull(), createdAt: text('created_at').notNull(),
 lastSeenAt: text('last_seen_at').notNull(), expiresAt: text('expires_at').notNull(),
},table=>[index('session_user').on(table.userId)]);
export const authTokens = sqliteTable('auth_tokens', {
 tokenHash: text('token_hash').primaryKey(), userId: text('user_id').notNull(), purpose: text('purpose').notNull(),
 expiresAt: text('expires_at').notNull(), usedAt: text('used_at'), createdAt: text('created_at').notNull(),
},table=>[index('auth_token_user').on(table.userId,table.purpose)]);
export const authAttempts = sqliteTable('auth_attempts', {
 key: text('key').primaryKey(), count: integer('count').notNull(), windowStartedAt: text('window_started_at').notNull(),
 lockedUntil: text('locked_until'),
});
export const accountProfiles = sqliteTable('account_profiles', {
 userId: text('user_id').notNull(), id: text('id').notNull(), data: text('data').notNull(),
 createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
},table=>[primaryKey({columns:[table.userId,table.id]})]);
export const accountOrderSnapshots = sqliteTable('account_order_snapshots', {
 userId: text('user_id').notNull(), id: text('id').notNull(), data: text('data').notNull(),
 importedAt: text('imported_at').notNull(),
},table=>[primaryKey({columns:[table.userId,table.id]})]);
