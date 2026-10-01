ALTER TABLE "noticeboard_posts" ADD COLUMN "event_id" uuid;--> statement-breakpoint
ALTER TABLE "noticeboard_posts" ADD CONSTRAINT "noticeboard_posts_event_id_key" UNIQUE("event_id");