const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type ClusterStats = {
  reportCount: number;
  centerLocation: string;
  dominantCategory: string;
  issueTypes: string[];
  averageUrgency: string;
  recentCount: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  categoryBreakdown: { category: string; count: number }[];
};

const GEMINI_MODEL = "gemini-3.6-flash";
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(cluster: ClusterStats): string {
  const catBreakdown = cluster.categoryBreakdown
    .map((c) => `${c.category}: ${c.count} reports`)
    .join(", ");
  const issueTypesStr = cluster.issueTypes.length > 0 ? cluster.issueTypes.join(", ") : "not specified";

  return `You are a civic intelligence analyst. Write a concise, factual explanation of a detected geographic hotspot. Use ONLY the statistics provided below — do not invent or estimate any numbers. Write exactly 2-3 sentences in plain language. Do not use markdown, headers, labels, or formatting — just the explanation text.

Detected cluster statistics (calculated by the application):
- Location: ${cluster.centerLocation}
- Total reports in cluster: ${cluster.reportCount}
- Dominant issue category: ${cluster.dominantCategory}
- Category breakdown: ${catBreakdown}
- Issue types: ${issueTypesStr}
- Average urgency: ${cluster.averageUrgency}
- Recent reports (last 7 days): ${cluster.recentCount}
- Date range: ${cluster.dateRangeStart} to ${cluster.dateRangeEnd}

Write the explanation now. Begin directly with the first sentence. Example: "7 citizen reports are concentrated within this area, with pothole-related issues representing the largest share. The average urgency is High, with 4 reports filed in the past week alone, suggesting an active and worsening situation."`;
}

function cleanText(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^#+\s*/gm, "");
  cleaned = cleaned.replace(/^\*+\**/gm, "");
  cleaned = cleaned.replace(/^"|"$/g, "");
  cleaned = cleaned.replace(/^(Response:|Explanation:|Summary:)\s*/i, "");
  return cleaned.trim();
}

function extractRetryDelayMs(errorBody: string): number {
  const match = errorBody.match(/"retryDelay":\s*"(\d+)s"/);
  if (match) {
    return parseInt(match[1], 10) * 1000 + 500;
  }
  return BASE_DELAY_MS;
}

async function explainCluster(cluster: ClusterStats): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const prompt = buildPrompt(cluster);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
  };

  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      const candidate = data?.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const text = candidate?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error(`Gemini returned no content (finishReason: ${finishReason ?? "unknown"})`);
      }

      const cleaned = cleanText(text);
      if (!cleaned || cleaned.length < 20) {
        throw new Error(`Gemini returned invalid explanation text (finishReason: ${finishReason ?? "unknown"})`);
      }

      return cleaned;
    }

    const errorText = await response.text();
    lastError = `Gemini API error (${response.status}): ${errorText}`;
    console.error(`explain-cluster: attempt ${attempt}/${MAX_RETRIES} — ${lastError.slice(0, 200)}`);

    // Only retry on 429/503 — and respect the retryDelay from the API
    if (response.status !== 429 && response.status !== 503) {
      throw new Error(lastError);
    }

    if (attempt < MAX_RETRIES) {
      const delay = extractRetryDelayMs(errorText);
      console.error(`explain-cluster: retrying in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw new Error(lastError);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();

    if (!Array.isArray(body.clusters)) {
      return new Response(
        JSON.stringify({ error: "clusters array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const explanations: { clusterId: string; explanation: string; error?: string }[] = [];

    for (const cluster of body.clusters as (ClusterStats & { clusterId: string })[]) {
      try {
        const explanation = await explainCluster(cluster);
        explanations.push({ clusterId: cluster.clusterId, explanation });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`explain-cluster: failed for cluster ${cluster.clusterId}: ${message.slice(0, 200)}`);
        explanations.push({ clusterId: cluster.clusterId, explanation: "", error: message });
      }
    }

    return new Response(
      JSON.stringify({ explanations }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("explain-cluster error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
