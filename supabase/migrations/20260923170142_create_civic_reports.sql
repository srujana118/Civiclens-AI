/*
# Create civic_reports table for CivicLens AI

## Overview
Creates the core `civic_reports` table that stores citizen-reported civic issues.
This is a single-tenant, no-auth app — citizens submit reports publicly, and all
data is intentionally shared/public for the civic intelligence dashboard.

## New Tables
- `civic_reports`
  - `id` (uuid, primary key)
  - `description` (text, not null) — the issue description from the citizen
  - `category` (text, not null) — e.g. "Potholes", "Street Lighting", "Sanitation", "Graffiti", "Noise", "Public Safety", "Water", "Parks", "Traffic", "Other"
  - `location` (text, not null) — free-text location description
  - `latitude` (double precision, nullable) — optional lat coordinate
  - `longitude` (double precision, nullable) — optional lng coordinate
  - `image_url` (text, nullable) — optional image URL
  - `language` (text, not null, default 'en') — language of the report
  - `status` (text, not null, default 'submitted') — processing status
  - `created_at` (timestamptz, default now())

## Indexes
- Index on `created_at` for recent-activity queries
- Index on `category` for category-based analytics

## Security
- RLS enabled on `civic_reports`
- Public CRUD policies (TO anon, authenticated) — data is intentionally shared
*/

CREATE TABLE IF NOT EXISTS civic_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  category text NOT NULL,
  location text NOT NULL,
  latitude double precision,
  longitude double precision,
  image_url text,
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_civic_reports_created_at ON civic_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_civic_reports_category ON civic_reports(category);

ALTER TABLE civic_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reports" ON civic_reports;
CREATE POLICY "anon_select_reports"
  ON civic_reports FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reports" ON civic_reports;
CREATE POLICY "anon_insert_reports"
  ON civic_reports FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reports" ON civic_reports;
CREATE POLICY "anon_update_reports"
  ON civic_reports FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reports" ON civic_reports;
CREATE POLICY "anon_delete_reports"
  ON civic_reports FOR DELETE
  TO anon, authenticated USING (true);
