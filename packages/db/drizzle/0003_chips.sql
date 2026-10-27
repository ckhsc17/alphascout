CREATE TABLE "tw_daily_chips" (
	"security_id" bigint NOT NULL,
	"date" date NOT NULL,
	"margin_balance" integer,
	"short_balance" integer,
	"margin_short_offset" integer,
	"foreign_holding_pct" real,
	"day_trade_volume" bigint,
	CONSTRAINT "tw_daily_chips_security_id_date_pk" PRIMARY KEY("security_id","date")
);
--> statement-breakpoint
ALTER TABLE "tw_indicator_snapshots" ADD COLUMN "margin_balance" integer;--> statement-breakpoint
ALTER TABLE "tw_indicator_snapshots" ADD COLUMN "margin_change5d" real;--> statement-breakpoint
ALTER TABLE "tw_indicator_snapshots" ADD COLUMN "short_margin_ratio" real;--> statement-breakpoint
ALTER TABLE "tw_indicator_snapshots" ADD COLUMN "foreign_holding_pct" real;--> statement-breakpoint
ALTER TABLE "tw_indicator_snapshots" ADD COLUMN "foreign_holding_change20d" real;--> statement-breakpoint
ALTER TABLE "tw_indicator_snapshots" ADD COLUMN "day_trade_pct" real;--> statement-breakpoint
ALTER TABLE "tw_daily_chips" ADD CONSTRAINT "tw_daily_chips_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE cascade ON UPDATE no action;