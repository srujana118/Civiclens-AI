/*
# Add AI analysis columns to civic_reports

## Overview
Adds columns to store Gemini-generated structured analysis alongside each citizen report.
When a report is submitted, the description is sent to Gemini which returns structured
JSON. Those fields are persisted here so the analysis is available alongside the report.

## Modified Tables
- `civic_reports`
  - `ai_category` (text, nullable) — AI-suggested category from Gemini
  - `ai_issue_type` (text, nullable) — specific issue type identified by AI
  - `ai_summary` (text, nullable) — concise AI-generated summary of the issue
  - `ai_urgency` (text, nullable) — urgency level (e.g. Low, Medium, High, Critical)
  - `ai_impact` (text, nullable) — description of community impact
  - `ai_keywords` (text[], nullable) — array of extracted keywords

## Security
- No RLS policy changes — existing public CRUD policies still apply.
*/

ALTER TABLE civic_reports
  ADD COLUMN IF NOT EXISTS ai_category text,
  ADD COLUMN IF NOT EXISTS ai_issue_type text,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_urgency text,
  ADD COLUMN IF NOT EXISTS ai_impact text,
  ADD COLUMN IF NOT EXISTS ai_keywords text[];
