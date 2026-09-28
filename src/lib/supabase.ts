import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type CivicReport = {
  id: string;
  description: string;
  category: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  language: string;
  status: string;
  created_at: string;
  ai_category: string | null;
  ai_issue_type: string | null;
  ai_summary: string | null;
  ai_urgency: string | null;
  ai_impact: string | null;
  ai_keywords: string[] | null;
};

export type ReportAnalysis = {
  category: string;
  issueType: string;
  summary: string;
  urgency: string;
  impact: string;
  keywords: string[];
};

export type CivicInsight = {
  id: string;
  title: string;
  summary: string;
  category: string;
  confidence: number;
  areas_affected: string | null;
  report_count: number;
  created_at: string;
};

export const REPORT_CATEGORIES = [
  'Potholes',
  'Street Lighting',
  'Sanitation',
  'Graffiti',
  'Noise',
  'Public Safety',
  'Water',
  'Parks & Recreational Facilities',
  'Traffic',
  'Other',
] as const;

export const LANGUAGES = [
  { code: 'en', label: 'English', bcp47: 'en-IN' },
  { code: 'hi', label: 'Hindi', bcp47: 'hi-IN' },
  { code: 'te', label: 'Telugu', bcp47: 'te-IN' },
  { code: 'kn', label: 'Kannada', bcp47: 'kn-IN' },
  { code: 'ta', label: 'Tamil', bcp47: 'ta-IN' },
  { code: 'ml', label: 'Malayalam', bcp47: 'ml-IN' },
  { code: 'mr', label: 'Marathi', bcp47: 'mr-IN' },
] as const;
