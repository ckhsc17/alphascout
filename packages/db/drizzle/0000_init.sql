CREATE TYPE "public"."ingest_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."market" AS ENUM('TW', 'US');--> statement-breakpoint
CREATE TYPE "public"."position_action" AS ENUM('new', 'exit', 'add', 'trim', 'hold');--> statement-breakpoint
CREATE TYPE "public"."put_call" AS ENUM('none', 'put', 'call');--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"target" text,
	"status" "ingest_status" DEFAULT 'running' NOT NULL,
	"rows" integer,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "securities" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"market" "market" NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"board" text,
	"industry" text,
	"cik" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tw_daily_prices" (
	"security_id" bigint NOT NULL,
	"date" date NOT NULL,
	"open" numeric(12, 2),
	"high" numeric(12, 2),
	"low" numeric(12, 2),
	"close" numeric(12, 2),
	"volume" bigint NOT NULL,
	"turnover" bigint,
	"transactions" integer,
	CONSTRAINT "tw_daily_prices_security_id_date_pk" PRIMARY KEY("security_id","date")
);
--> statement-breakpoint
CREATE TABLE "tw_indicator_snapshots" (
	"security_id" bigint NOT NULL,
	"date" date NOT NULL,
	"close" double precision,
	"change_pct" double precision,
	"sma5" double precision,
	"sma20" double precision,
	"sma60" double precision,
	"sma120" double precision,
	"rsi14" double precision,
	"macd" double precision,
	"macd_signal" double precision,
	"macd_hist" double precision,
	"bb_upper" double precision,
	"bb_lower" double precision,
	"atr14" double precision,
	"avg_volume20d" double precision,
	"volume_ratio" double precision,
	"high52w" double precision,
	"low52w" double precision,
	"foreign_net_buy_streak" integer,
	"trust_net_buy_streak" integer,
	"dealer_net_buy_streak" integer,
	"major_holder_pct" double precision,
	"major_holder_pct_change4w" double precision,
	"revenue_yoy" double precision,
	CONSTRAINT "tw_indicator_snapshots_security_id_date_pk" PRIMARY KEY("security_id","date")
);
--> statement-breakpoint
CREATE TABLE "tw_insider_transfers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"security_id" bigint NOT NULL,
	"reported_on" date NOT NULL,
	"insider_name" text NOT NULL,
	"role" text,
	"method" text,
	"shares" bigint NOT NULL,
	"source_key" text NOT NULL,
	CONSTRAINT "tw_insider_transfers_sourceKey_unique" UNIQUE("source_key")
);
--> statement-breakpoint
CREATE TABLE "tw_institutional_flows" (
	"security_id" bigint NOT NULL,
	"date" date NOT NULL,
	"foreign_net" bigint NOT NULL,
	"trust_net" bigint NOT NULL,
	"dealer_net" bigint NOT NULL,
	CONSTRAINT "tw_institutional_flows_security_id_date_pk" PRIMARY KEY("security_id","date")
);
--> statement-breakpoint
CREATE TABLE "tw_monthly_revenue" (
	"security_id" bigint NOT NULL,
	"month" date NOT NULL,
	"revenue" bigint NOT NULL,
	"mom" double precision,
	"yoy" double precision,
	CONSTRAINT "tw_monthly_revenue_security_id_month_pk" PRIMARY KEY("security_id","month")
);
--> statement-breakpoint
CREATE TABLE "tw_shareholding_dist" (
	"security_id" bigint NOT NULL,
	"week_date" date NOT NULL,
	"tier" integer NOT NULL,
	"holders" integer NOT NULL,
	"shares" bigint NOT NULL,
	"pct" double precision NOT NULL,
	CONSTRAINT "tw_shareholding_dist_security_id_week_date_tier_pk" PRIMARY KEY("security_id","week_date","tier")
);
--> statement-breakpoint
CREATE TABLE "cusip_map" (
	"cusip" text PRIMARY KEY NOT NULL,
	"ticker" text,
	"figi" text,
	"name" text,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "us_13f_changes" (
	"cik" text NOT NULL,
	"period" date NOT NULL,
	"cusip" text NOT NULL,
	"put_call" "put_call" DEFAULT 'none' NOT NULL,
	"action" "position_action" NOT NULL,
	"shares" bigint NOT NULL,
	"prev_shares" bigint NOT NULL,
	"shares_change_pct" double precision,
	"value" bigint NOT NULL,
	"weight" double precision NOT NULL,
	CONSTRAINT "us_13f_changes_cik_period_cusip_put_call_pk" PRIMARY KEY("cik","period","cusip","put_call")
);
--> statement-breakpoint
CREATE TABLE "us_13f_filings" (
	"accession_no" text PRIMARY KEY NOT NULL,
	"cik" text NOT NULL,
	"period_of_report" date NOT NULL,
	"filed_at" timestamp with time zone NOT NULL,
	"form_type" text NOT NULL,
	"is_amendment" boolean DEFAULT false NOT NULL,
	"amendment_type" text,
	"total_value" bigint
);
--> statement-breakpoint
CREATE TABLE "us_13f_holdings" (
	"accession_no" text NOT NULL,
	"cusip" text NOT NULL,
	"put_call" "put_call" DEFAULT 'none' NOT NULL,
	"issuer" text NOT NULL,
	"title_of_class" text,
	"value" bigint NOT NULL,
	"shares" bigint NOT NULL,
	CONSTRAINT "us_13f_holdings_accession_no_cusip_put_call_pk" PRIMARY KEY("accession_no","cusip","put_call")
);
--> statement-breakpoint
CREATE TABLE "us_insider_trades" (
	"accession_no" text NOT NULL,
	"line" integer NOT NULL,
	"issuer_cik" text NOT NULL,
	"ticker" text,
	"insider_cik" text NOT NULL,
	"insider_name" text NOT NULL,
	"is_director" boolean DEFAULT false NOT NULL,
	"is_officer" boolean DEFAULT false NOT NULL,
	"is_ten_percent_owner" boolean DEFAULT false NOT NULL,
	"officer_title" text,
	"transaction_date" date NOT NULL,
	"code" text NOT NULL,
	"acquired" boolean NOT NULL,
	"shares" double precision NOT NULL,
	"price" double precision,
	"shares_owned_after" double precision,
	"filed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "us_insider_trades_accession_no_line_pk" PRIMARY KEY("accession_no","line")
);
--> statement-breakpoint
CREATE TABLE "us_investors" (
	"cik" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"manager" text,
	"slug" text NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	CONSTRAINT "us_investors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "tw_daily_prices" ADD CONSTRAINT "tw_daily_prices_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_indicator_snapshots" ADD CONSTRAINT "tw_indicator_snapshots_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_insider_transfers" ADD CONSTRAINT "tw_insider_transfers_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_institutional_flows" ADD CONSTRAINT "tw_institutional_flows_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_monthly_revenue" ADD CONSTRAINT "tw_monthly_revenue_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_shareholding_dist" ADD CONSTRAINT "tw_shareholding_dist_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "us_13f_changes" ADD CONSTRAINT "us_13f_changes_cik_us_investors_cik_fk" FOREIGN KEY ("cik") REFERENCES "public"."us_investors"("cik") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "us_13f_filings" ADD CONSTRAINT "us_13f_filings_cik_us_investors_cik_fk" FOREIGN KEY ("cik") REFERENCES "public"."us_investors"("cik") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "us_13f_holdings" ADD CONSTRAINT "us_13f_holdings_accession_no_us_13f_filings_accession_no_fk" FOREIGN KEY ("accession_no") REFERENCES "public"."us_13f_filings"("accession_no") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingest_runs_job_started_at_index" ON "ingest_runs" USING btree ("job","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "securities_market_symbol_index" ON "securities" USING btree ("market","symbol");--> statement-breakpoint
CREATE INDEX "securities_cik_index" ON "securities" USING btree ("cik") WHERE "securities"."cik" is not null;--> statement-breakpoint
CREATE INDEX "us_13f_changes_period_cusip_index" ON "us_13f_changes" USING btree ("period","cusip");--> statement-breakpoint
CREATE INDEX "us_13f_filings_cik_period_of_report_index" ON "us_13f_filings" USING btree ("cik","period_of_report");--> statement-breakpoint
CREATE INDEX "us_insider_trades_issuer_cik_transaction_date_index" ON "us_insider_trades" USING btree ("issuer_cik","transaction_date");--> statement-breakpoint
CREATE INDEX "us_insider_trades_transaction_date_index" ON "us_insider_trades" USING btree ("transaction_date") WHERE "us_insider_trades"."code" = 'P';