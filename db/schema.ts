import { boolean, index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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

export const familyEventRsvps = pgTable('family_event_rsvps', {
  eventId: uuid('event_id').notNull(),
  familyId: text('family_id').notNull(),
  memberIds: text('member_ids').array().notNull(),
  guestNames: text('guest_names').array().notNull(),
  nobodyAttending: boolean('nobody_attending').notNull(),
  createdAt: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
}, (table) => [primaryKey({ columns: [table.eventId, table.familyId] })])
