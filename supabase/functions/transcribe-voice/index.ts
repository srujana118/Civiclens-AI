const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LANGUAGE_NAMES: Record<string, string> = {
  "te-IN": "Telugu",
  "hi-IN": "Hindi",
  "kn-IN": "Kannada",
  "ta-IN": "Tamil",
  "mr-IN": "Marathi",
  "ml-IN": "Malayalam",
  "bn-IN": "Bengali",
  "gu-IN": "Gujarati",
  "pa-IN": "Punjabi",
  "or-IN": "Odia",
  "as-IN": "Assamese",
  "en-IN": "English",
  "en-US": "English",
  "en-GB": "English",
};

function jsonResponse(
  data: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeLanguageCode(
  value: string,
): string {
  const text = value.toLowerCase().trim();

  if (text.includes("telugu")) return "te-IN";
  if (text.includes("hindi")) return "hi-IN";
  if (text.includes("kannada")) return "kn-IN";
  if (text.includes("tamil")) return "ta-IN";
  if (text.includes("marathi")) return "mr-IN";
  if (text.includes("malayalam")) return "ml-IN";
  if (text.includes("bengali")) return "bn-IN";
  if (text.includes("gujarati")) return "gu-IN";
  if (text.includes("punjabi")) return "pa-IN";
  if (text.includes("odia")) return "or-IN";
  if (text.includes("assamese")) return "as-IN";
  if (text.includes("english")) return "en-IN";

  return "unknown";
}

function cleanJsonText(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed",
      },
      405,
    );
  }

  try {
    if (!GEMINI_API_KEY) {
      return jsonResponse(
        {
          success: false,
          error: "GEMINI_API_KEY is not configured",
        },
        500,
      );
    }

    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return jsonResponse(
        {
          success: false,
          error:
            "Audio file is required. Send the recording using the 'audio' field.",
        },
        400,
      );
    }

    if (audio.size === 0) {
      return jsonResponse(
        {
          success: false,
          error: "The audio file is empty.",
        },
        400,
      );
    }

    const mimeType =
      audio.type && audio.type.startsWith("audio/")
        ? audio.type
        : "audio/webm";

    const audioBytes = new Uint8Array(
      await audio.arrayBuffer(),
    );

    /*
     * STEP 1
     * Upload the audio to Gemini Files API.
     */
    const startUploadResponse = await fetch(
      "https://generativelanguage.googleapis.com/upload/v1beta/files",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length":
            String(audioBytes.length),
          "X-Goog-Upload-Header-Content-Type":
            mimeType,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file: {
            display_name:
              audio.name || "civic-report-voice",
          },
        }),
      },
    );

    if (!startUploadResponse.ok) {
      const errorText =
        await startUploadResponse.text();

      throw new Error(
        `Gemini upload initialization failed: ${startUploadResponse.status} ${errorText}`,
      );
    }

    const uploadUrl =
      startUploadResponse.headers.get(
        "x-goog-upload-url",
      );

    if (!uploadUrl) {
      throw new Error(
        "Gemini did not return an upload URL.",
      );
    }

    /*
     * STEP 2
     * Upload the actual audio bytes.
     */
    const uploadResponse = await fetch(
      uploadUrl,
      {
        method: "POST",
        headers: {
          "Content-Length": String(
            audioBytes.length,
          ),
          "X-Goog-Upload-Offset": "0",
          "X-Goog-Upload-Command":
            "upload, finalize",
        },
        body: audioBytes,
      },
    );

    if (!uploadResponse.ok) {
      const errorText =
        await uploadResponse.text();

      throw new Error(
        `Gemini audio upload failed: ${uploadResponse.status} ${errorText}`,
      );
    }

    const uploadedFile =
      await uploadResponse.json();

    const fileUri =
      uploadedFile?.file?.uri;

    if (!fileUri) {
      throw new Error(
        "Gemini did not return a file URI.",
      );
    }

    /*
     * STEP 3
     *
     * Analyze the ACTUAL AUDIO.
     *
     * This is important:
     * We do NOT first transcribe and then try
     * to guess the language from bad English text.
     *
     * Gemini receives the audio directly and is
     * instructed to:
     * 1. detect the spoken language
     * 2. transcribe it
     * 3. preserve the native script
     */
    const prompt = `
You are the multilingual voice transcription system for CivicLens AI.

Listen to the attached citizen voice recording.

Your task is to identify the language actually spoken in the audio and
produce an accurate transcription of exactly what the citizen said.

Supported Indian languages include:
Telugu, Hindi, Kannada, Tamil, Marathi, Malayalam, Bengali, Gujarati,
Punjabi, Odia, Assamese and English.

IMPORTANT RULES:

1. Detect the language from the AUDIO itself.
2. Do NOT determine the language from an English or phonetic guess.
3. If the citizen speaks Telugu, write the transcription in TELUGU SCRIPT.
4. If the citizen speaks Hindi, write the transcription in DEVANAGARI SCRIPT.
5. If the citizen speaks Kannada, write it in KANNADA SCRIPT.
6. If the citizen speaks Tamil, write it in TAMIL SCRIPT.
7. If the citizen speaks Malayalam, write it in MALAYALAM SCRIPT.
8. If the citizen speaks Bengali, write it in BENGALI SCRIPT.
9. If the citizen speaks Marathi, write it in DEVANAGARI SCRIPT.
10. If the citizen speaks Gujarati, write it in GUJARATI SCRIPT.
11. If the citizen speaks Punjabi, write it in GURMUKHI SCRIPT.
12. If the citizen speaks Odia, write it in ODIA SCRIPT.
13. If the citizen speaks Assamese, write it in ASSAMESE SCRIPT.
14. If the citizen speaks English, write it in normal English.
15. NEVER transliterate an Indian-language speech into English letters.
16. NEVER translate the citizen's speech into English.
17. Preserve the actual meaning and words spoken by the citizen.
18. Do not invent words that were not spoken.
19. If the speaker mixes languages, identify the primary language.
20. Return ONLY valid JSON.

Return exactly this structure:

{
  "transcription": "original-language transcription",
  "detectedLanguage": "Telugu",
  "detectedLanguageCode": "te-IN"
}

The detectedLanguage must be exactly one of:

Telugu
Hindi
Kannada
Tamil
Marathi
Malayalam
Bengali
Gujarati
Punjabi
Odia
Assamese
English
Other

The detectedLanguageCode must be the corresponding BCP-47 code.
`;

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  file_data: {
                    file_uri: fileUri,
                    mime_type: mimeType,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const errorText =
        await geminiResponse.text();

      throw new Error(
        `Gemini transcription failed: ${geminiResponse.status} ${errorText}`,
      );
    }

    const geminiData =
      await geminiResponse.json();

    const generatedText =
      geminiData?.candidates?.[0]
        ?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error(
        "Gemini returned no transcription.",
      );
    }

    /*
     * STEP 4
     * Parse Gemini's structured response.
     */
    let result: {
      transcription?: string;
      detectedLanguage?: string;
      detectedLanguageCode?: string;
    };

    try {
      result = JSON.parse(
        cleanJsonText(generatedText),
      );
    } catch {
      throw new Error(
        "Gemini returned invalid JSON.",
      );
    }

    const transcription =
      result.transcription?.trim();

    if (!transcription) {
      throw new Error(
        "Gemini returned an empty transcription.",
      );
    }

    /*
     * STEP 5
     * Normalize the detected language.
     */
    let detectedLanguageCode =
      result.detectedLanguageCode?.trim() ||
      "";

    if (
      !LANGUAGE_NAMES[
        detectedLanguageCode
      ]
    ) {
      detectedLanguageCode =
        normalizeLanguageCode(
          result.detectedLanguage || "",
        );
    }

    const detectedLanguage =
      LANGUAGE_NAMES[
        detectedLanguageCode
      ] ||
      result.detectedLanguage?.trim() ||
      "Other";

    /*
     * FINAL RESPONSE
     *
     * The frontend receives the same fields
     * it already expects.
     */
    return jsonResponse({
      success: true,
      transcription,
      detectedLanguage,
      detectedLanguageCode:
        detectedLanguageCode === "unknown"
          ? "unknown"
          : detectedLanguageCode,
    });
  } catch (error) {
    console.error(
      "Transcribe voice error:",
      error,
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Voice transcription failed.",
      },
      500,
    );
  }
});