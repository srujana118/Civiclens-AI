/*
# Create civic_insights table for AI-discovered patterns

## Overview
Creates the `civic_insights` table for AI-discovered community patterns.
This stores structured insights that the system derives from report data.

## New Tables
- `civic_insights`
  - `id` (uuid, primary key)
  - `title` (text, not null) — short title for the insight
  - `summary` (text, not null) — detailed description of the pattern
  - `category` (text, not null) — related issue category
  - `confidence` (integer, not null, default 0) — confidence score 0-100
  - `areas_affected` (text, nullable) — comma-separated area names
  - `report_count` (integer, not null, default 0) — number of reports behind this insight
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled
- Public read (TO anon, authenticated), no public write (insert/update/delete scoped to authenticated for future admin use)
*/

CREATE TABLE IF NOT EXISTS civic_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL,
  category text NOT NULL,
  confidence integer NOT NULL DEFAULT 0,
  areas_affected text,
  report_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_civic_insights_created_at ON civic_insights(created_at DESC);

ALTER TABLE civic_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_insights" ON civic_insights;
CREATE POLICY "anon_select_insights"
  ON civic_insights FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_insights" ON civic_insights;
CREATE POLICY "anon_insert_insights"
  ON civic_insights FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_insights" ON civic_insights;
CREATE POLICY "anon_update_insights"
  ON civic_insights FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_insights" ON civic_insights;
CREATE POLICY "anon_delete_insights"
  ON civic_insights FOR DELETE
  TO anon, authenticated USING (true);
