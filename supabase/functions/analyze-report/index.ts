import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type AnalysisResult = {
  category: string;
  issueType: string;
  summary: string;
  urgency: string;
  impact: string;
  keywords: string[];
};

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    category: {
      type: "string",
      description: "Broad civic issue category (e.g. Potholes, Street Lighting, Sanitation, Graffiti, Noise, Public Safety, Water, Parks, Traffic, Other)",
    },
    issueType: {
      type: "string",
      description: "Specific type of issue identified from the description",
    },
    summary: {
      type: "string",
      description: "A concise one-sentence summary of the reported issue",
    },
    urgency: {
      type: "string",
      description: "Urgency level: Low, Medium, High, or Critical",
    },
    impact: {
      type: "string",
      description: "Brief description of the potential impact on the community",
    },
    keywords: {
      type: "array",
      items: { type: "string" },
      description: "3-7 relevant keywords extracted from the report",
    },
  },
  required: ["category", "issueType", "summary", "urgency", "impact", "keywords"],
};

async function analyzeReport(description: string): Promise<AnalysisResult> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are a civic issue analyst. Analyze the following citizen-reported issue and return structured analysis.\n\nReport description: "${description}"\n\nProvide the category (choose from: Potholes, Street Lighting, Sanitation, Graffiti, Noise, Public Safety, Water, Parks, Traffic, Other), the specific issue type, a concise summary, urgency level, community impact, and relevant keywords.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 512,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned no content");
  }

  const parsed = JSON.parse(text) as AnalysisResult;

  const required: (keyof AnalysisResult)[] = ["category", "issueType", "summary", "urgency", "impact", "keywords"];
  for (const field of required) {
    if (parsed[field] === undefined || parsed[field] === null) {
      throw new Error(`Gemini response missing field: ${field}`);
    }
  }

  if (!Array.isArray(parsed.keywords)) {
    parsed.keywords = String(parsed.keywords).split(",").map((s) => s.trim());
  }

  return parsed;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { description, reportId } = body;
    if (!description || typeof description !== "string") {
      return new Response(
        JSON.stringify({ error: "description is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const analysis = await analyzeReport(description);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    let savedReport = null;
    if (supabaseUrl && serviceRoleKey && reportId) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      const { data, error: updateError } = await supabase
        .from("civic_reports")
        .update({
          ai_category: analysis.category,
          ai_issue_type: analysis.issueType,
          ai_summary: analysis.summary,
          ai_urgency: analysis.urgency,
          ai_impact: analysis.impact,
          ai_keywords: analysis.keywords,
        })
        .eq("id", reportId)
        .select()
        .single();

      if (updateError) {
        console.error("analyze-report: failed to save analysis to report:", updateError.message);
      } else {
        savedReport = data;
      }
    }

    return new Response(
      JSON.stringify({ analysis, report: savedReport }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("analyze-report error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
