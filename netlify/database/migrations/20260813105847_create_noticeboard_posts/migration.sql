CREATE TABLE "noticeboard_posts" (
	"id" uuid PRIMARY KEY,
	"owner_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "noticeboard_posts_status_created_at_idx" ON "noticeboard_posts" ("status","created_at");--> statement-breakpoint
CREATE INDEX "noticeboard_posts_owner_id_idx" ON "noticeboard_posts" ("owner_id");