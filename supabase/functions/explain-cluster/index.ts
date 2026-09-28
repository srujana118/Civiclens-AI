const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Cluster = {
  clusterId: string;
  reportCount: number;
  centerLocation: string;
  dominantCategory: string;
  issueTypes: string[];
  averageUrgency: string;
  recentCount: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  priorityLevel: string;
  priorityScore: number;
  priorityReason: string;
  categoryBreakdown: {
    category: string;
    count: number;
  }[];
};

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}

Deno.serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed",
      },
      405,
    );
  }

  try {
    const apiKey =
      Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      console.error(
        "GEMINI_API_KEY is missing",
      );

      return jsonResponse(
        {
          error:
            "GEMINI_API_KEY is not configured in Supabase.",
        },
        500,
      );
    }

    const body = await req.json();

    const clusters: Cluster[] =
      Array.isArray(body?.clusters)
        ? body.clusters
        : [];

    if (clusters.length === 0) {
      return jsonResponse(
        {
          error: "No cluster data supplied.",
        },
        400,
      );
    }

    const explanations: {
      clusterId: string;
      explanation: string;
    }[] = [];

    for (const cluster of clusters) {
      const categoryBreakdown =
        cluster.categoryBreakdown
          ?.map(
            (item) =>
              `${item.category}: ${item.count}`,
          )
          .join(", ") ||
        "Not available";

      const issueTypes =
        cluster.issueTypes?.join(", ") ||
        "Not specified";

      const prompt = `
You are CivicLens AI, a civic infrastructure intelligence system.

Analyze the supplied citizen-report hotspot.

Use ONLY the supplied information.
Do not invent causes, statistics, locations, infrastructure conditions, or facts.
Do not mention AI.
Do not give generic recommendations.

Explain:
1. What the concentration of reports shows.
2. What type of civic issue is concentrated there.
3. Why the hotspot has its current priority level.

HOTSPOT DATA

Location:
${cluster.centerLocation}

Total reports:
${cluster.reportCount}

Dominant category:
${cluster.dominantCategory}

Issue types:
${issueTypes}

Average urgency:
${cluster.averageUrgency}

Recent reports:
${cluster.recentCount}

Date range:
${cluster.dateRangeStart} to ${cluster.dateRangeEnd}

Priority level:
${cluster.priorityLevel}

Priority score:
${cluster.priorityScore}/100

Priority reason:
${cluster.priorityReason}

Category breakdown:
${categoryBreakdown}

Write exactly 2 concise sentences.
`;

      const response =
        await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
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
                maxOutputTokens: 200,
              },
            }),
          },
        );

      const responseText =
        await response.text();

      if (!response.ok) {
        console.error(
          "Gemini API error:",
          response.status,
          responseText,
        );

        return jsonResponse(
          {
            error:
              `Gemini API error ${response.status}`,
            details: responseText,
          },
          500,
        );
      }

      let geminiData: any;

      try {
        geminiData =
          JSON.parse(responseText);
      } catch {
        console.error(
          "Invalid Gemini response:",
          responseText,
        );

        throw new Error(
          "Gemini returned an invalid response.",
        );
      }

      const explanation =
        geminiData
          ?.candidates?.[0]
          ?.content?.parts
          ?.map(
            (part: {
              text?: string;
            }) =>
              part.text ?? "",
          )
          .join("")
          .trim();

      if (!explanation) {
        console.error(
          "Empty Gemini response:",
          JSON.stringify(
            geminiData,
          ),
        );

        throw new Error(
          "Gemini returned no explanation.",
        );
      }

      explanations.push({
        clusterId:
          cluster.clusterId,

        explanation,
      });
    }

    return jsonResponse({
      explanations,
    });
  } catch (error) {
    console.error(
      "explain-cluster error:",
      error,
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate AI insight.",
      },
      500,
    );
  }
});