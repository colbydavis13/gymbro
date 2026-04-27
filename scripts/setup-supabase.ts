import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("SUPABASE_URL and SUPABASE_ANON_KEY must be set");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const SQL_SETUP = `
CREATE TABLE IF NOT EXISTS schedule (
  id SERIAL PRIMARY KEY,
  daily_time TEXT NOT NULL DEFAULT '09:00',
  target_email TEXT,
  weekly_goal INTEGER NOT NULL DEFAULT 3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  choice TEXT NOT NULL,
  hesitation_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduler_runs (
  id SERIAL PRIMARY KEY,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  push_status TEXT NOT NULL,
  push_error TEXT,
  push_sent INTEGER NOT NULL DEFAULT 0,
  push_failed INTEGER NOT NULL DEFAULT 0,
  email_status TEXT NOT NULL,
  email_error TEXT
);
`;

async function setup() {
  console.log("Setting up Supabase tables...");

  // Use the Supabase rpc to run SQL (requires pg_execute or similar)
  // Alternatively, try inserting a dummy row to check if tables exist
  const { error: scheduleErr } = await supabase.from("schedule").select("id").limit(1);
  if (scheduleErr?.code === "42P01") {
    console.log("Tables do not exist. Please run the following SQL in your Supabase SQL Editor:");
    console.log(SQL_SETUP);
    console.log("\nNavigate to: https://supabase.com/dashboard/project/_/sql/new");
  } else if (scheduleErr) {
    console.error("Unexpected error checking schedule table:", scheduleErr);
  } else {
    console.log("Tables already exist — Supabase connection successful!");
  }
}

setup().catch(console.error);
