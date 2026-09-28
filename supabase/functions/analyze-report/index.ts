import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  description: string;
  reportId: string;
}

interface ReportAnalysis {
  detectedLanguage: string;
  detectedLanguages: string[];
  category: string;
  issueType: string;
  summary: string;
  urgency: string;
  impact: string;
  keywords: string[];
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",
);

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const body = (await req.json()) as RequestBody;

    const description = body.description?.trim();
    const reportId = body.reportId;

    if (!description || !reportId) {
      return new Response(
        JSON.stringify({
          error: "description and reportId are required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const prompt = `
You are CivicLens AI, an AI system that analyzes citizen infrastructure
reports from communities across India.

The citizen may write using:
- English
- Hindi
- Telugu
- Tamil
- Kannada
- Malayalam
- Marathi
- Bengali
- Gujarati
- Punjabi
- Odia
- Urdu
- or a mixture of multiple languages.

The report may also contain English words mixed with an Indian language.

IMPORTANT:
- Detect the language or languages used in the citizen's report.
- If more than one language is used, include all detected languages.
- Do not translate the original citizen report.
- Understand the meaning regardless of language.
- Analyze the issue based on meaning.

Citizen report:
"${description}"

Return ONLY valid JSON in exactly this structure:

{
  "detectedLanguage": "primary detected language",
  "detectedLanguages": ["language1", "language2"],
  "category": "one of: Potholes, Street Lighting, Sanitation, Graffiti, Noise, Public Safety, Water, Parks & Recreational Facilities, Traffic, Other",
  "issueType": "short specific issue type",
  "summary": "one concise sentence summarizing the issue in English",
  "urgency": "Low, Medium, High, or Critical",
  "impact": "short explanation of the impact on citizens in English",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Rules:
- detectedLanguage must be the primary language.
- detectedLanguages must contain every language clearly present.
- Use language names such as "English", "Telugu", "Hindi", "Tamil", etc.
- If the report contains only English, return ["English"].
- If the report mixes Telugu and English, return ["Telugu", "English"].
- Choose the most appropriate infrastructure category.
- Use High or Critical only when the report indicates significant urgency or safety risk.
- Keep summary and impact concise.
- Return JSON only.
`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();

      throw new Error(
        `Gemini API error: ${geminiResponse.status} ${errorText}`,
      );
    }

    const geminiData = await geminiResponse.json();

    const generatedText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error("Gemini returned no analysis");
    }

    let analysis: ReportAnalysis;

    try {
      analysis = JSON.parse(generatedText);
    } catch {
      throw new Error("Gemini returned invalid JSON");
    }

    if (!analysis.detectedLanguages?.length) {
      analysis.detectedLanguages = [
        analysis.detectedLanguage || "Unknown",
      ];
    }

    const { error: updateError } = await supabase
      .from("civic_reports")
      .update({
        ai_category: analysis.category,
        ai_issue_type: analysis.issueType,
        ai_summary: analysis.summary,
        ai_urgency: analysis.urgency,
        ai_impact: analysis.impact,
        ai_keywords: analysis.keywords,
      })
      .eq("id", reportId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        language: analysis.detectedLanguage,
        languages: analysis.detectedLanguages,
        analysis,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Analyze report error:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});