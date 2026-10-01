CREATE TABLE "family_event_rsvps" (
	"event_id" uuid,
	"family_id" text,
	"member_ids" text[] NOT NULL,
	"guest_names" text[] NOT NULL,
	"nobody_attending" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "family_event_rsvps_pkey" PRIMARY KEY("event_id","family_id")
);
