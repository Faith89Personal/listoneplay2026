#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(url);

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`,
  `CREATE TABLE IF NOT EXISTS selections (
    email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    item_id INTEGER NOT NULL,
    flag TEXT NOT NULL CHECK (flag IN ('look', 'play', 'buy')),
    state TEXT NOT NULL CHECK (state IN ('checked', 'forbidden')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (email, item_id, flag)
  )`,
  `CREATE TABLE IF NOT EXISTS reservations (
    email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    item_id INTEGER NOT NULL,
    reserved_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (email, item_id)
  )`,
  `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60`,
  `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS share_token TEXT`,
  `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS max_seats INTEGER`,
  `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS shared_with TEXT[] NOT NULL DEFAULT '{}'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS reservations_share_token_idx ON reservations (share_token) WHERE share_token IS NOT NULL`,
  `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guests TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE manual_events ADD COLUMN IF NOT EXISTS share_token TEXT`,
  `ALTER TABLE manual_events ADD COLUMN IF NOT EXISTS max_seats INTEGER`,
  `ALTER TABLE manual_events ADD COLUMN IF NOT EXISTS shared_with TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE manual_events ADD COLUMN IF NOT EXISTS guests TEXT[] NOT NULL DEFAULT '{}'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS manual_events_share_token_idx ON manual_events (share_token) WHERE share_token IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS manual_events (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    name TEXT NOT NULL,
    reserved_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    stand TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS plays (
    email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    item_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    note TEXT,
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (email, item_id)
  )`,
  `CREATE TABLE IF NOT EXISTS manual_plays (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    name TEXT NOT NULL,
    editor TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    played_on DATE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS manual_items (
    email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    id INTEGER NOT NULL,
    name TEXT NOT NULL,
    editor TEXT NOT NULL DEFAULT '',
    category_id INTEGER NOT NULL,
    stand TEXT,
    id_bgg INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (email, id),
    CHECK (id < 0)
  )`,
  `CREATE TABLE IF NOT EXISTS rushes (
    email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    item_id INTEGER NOT NULL,
    rush_day DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (email, item_id, rush_day)
  )`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS selections_email_idx ON selections (email)`,
  `CREATE INDEX IF NOT EXISTS reservations_email_idx ON reservations (email)`,
  `CREATE INDEX IF NOT EXISTS manual_events_email_idx ON manual_events (email)`,
  `CREATE INDEX IF NOT EXISTS plays_email_idx ON plays (email)`,
  `CREATE INDEX IF NOT EXISTS manual_plays_email_idx ON manual_plays (email)`,
  `CREATE INDEX IF NOT EXISTS manual_items_email_idx ON manual_items (email)`,
  `CREATE INDEX IF NOT EXISTS rushes_email_day_idx ON rushes (email, rush_day)`,
  `CREATE INDEX IF NOT EXISTS push_subscriptions_email_idx ON push_subscriptions (email)`,
];

for (const stmt of statements) {
  process.stdout.write(`Running: ${stmt.slice(0, 60).replace(/\s+/g, " ")} … `);
  await sql.query(stmt);
  console.log("ok");
}
console.log("Migration completed.");
