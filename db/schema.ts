import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const noticeboardPosts = pgTable('noticeboard_posts', {
  id: uuid().primaryKey(),
  ownerId: text('owner_id').notNull(),
  type: text().notNull(),
  title: text().notNull(),
  description: text().notNull().default(''),
  status: text().notNull().default('open'),
  createdAt: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
}, (table) => [
  index('noticeboard_posts_status_created_at_idx').on(table.status, table.createdAt),
  index('noticeboard_posts_owner_id_idx').on(table.ownerId),
])
