import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ==========================================
// 1. CONFIGURATION
// ==========================================

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ==========================================
// 2. RESPONSE HELPER
// ==========================================

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

// ==========================================
// 3. MAIN EDGE FUNCTION
// ==========================================

Deno.serve(async (req) => {

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Only POST requests are accepted
  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed" },
      405
    );
  }

  try {

    // ======================================
    // 4. CHECK API KEY
    // ======================================

    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is missing");

      return jsonResponse(
        { error: "AI service is not configured" },
        500
      );
    }

    // ======================================
    // 5. READ REQUEST
    // ======================================

    let body;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { error: "Invalid JSON request" },
        400
      );
    }

    const message = body?.message;

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return jsonResponse(
        { error: "Message is required" },
        400
      );
    }

    if (message.length > 4000) {
      return jsonResponse(
        { error: "Message is too long" },
        400
      );
    }

    // ======================================
    // 6. PROCESS CHAT HISTORY
    // ======================================

    const history = Array.isArray(body.history)
      ? body.history.slice(-10)
      : [];

    const input = history
      .filter((item: any) =>
        item &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string"
      )
      .map((item: any) => ({
        role: item.role,
        content: item.content.slice(0, 4000),
      }));

    // Add current message
    input.push({
      role: "user",
      content: message.trim(),
    });

    // ======================================
    // 7. OPENAI API REQUEST
    // ======================================

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      45000
    );

    let response: Response;

    try {
      response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            model: "gpt-4.1-mini",

            instructions: `
You are Vertex Coach, the intelligent personal growth assistant
inside the Vertex Habit Tracker application.

Your responsibilities:
- Help users build consistent habits.
- Give practical productivity advice.
- Help users organize their daily routines.
- Analyze their progress when context is provided.
- Encourage realistic and sustainable improvement.
- Give clear, supportive and actionable answers.

Keep responses natural, useful and easy to understand.
Use the user's language whenever possible.
Avoid unnecessary long explanations.
            `.trim(),

            input,

            max_output_tokens: 700,

            store: false,
          }),

          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    // ======================================
    // 8. READ OPENAI RESPONSE
    // ======================================

    const responseText = await response.text();

    let result: any;

    try {
      result = JSON.parse(responseText);
    } catch {
      console.error(
        "Invalid OpenAI response:",
        responseText.slice(0, 1000)
      );

      return jsonResponse(
        { error: "Invalid response from AI service" },
        502
      );
    }

    // ======================================
    // 9. HANDLE OPENAI ERRORS
    // ======================================

    if (!response.ok) {
      console.error("OpenAI API error:", {
        status: response.status,
        error: result?.error,
      });

      return jsonResponse(
        {
          error: "AI service request failed",
          details:
            result?.error?.message ||
            "The AI provider returned an error",
        },
        502
      );
    }

    // ======================================
    // 10. EXTRACT AI REPLY
    // ======================================

    let reply = result.output_text;

    // Fallback if output_text is unavailable
    if (!reply && Array.isArray(result.output)) {
      reply = result.output
        .flatMap((item: any) =>
          Array.isArray(item.content)
            ? item.content
            : []
        )
        .filter((item: any) =>
          item.type === "output_text" &&
          typeof item.text === "string"
        )
        .map((item: any) => item.text)
        .join("\n");
    }

    if (
      typeof reply !== "string" ||
      !reply.trim()
    ) {
      console.error(
        "AI returned no text:",
        JSON.stringify(result).slice(0, 2000)
      );

      return jsonResponse(
        { error: "AI could not generate a response" },
        502
      );
    }

    // ======================================
    // 11. SUCCESS
    // ======================================

    return jsonResponse({
      reply: reply.trim(),
    });

  } catch (error) {

    // ======================================
    // 12. ERROR HANDLING
    // ======================================

    console.error("Vertex AI Coach error:", error);

    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      return jsonResponse(
        { error: "AI request timed out. Please try again." },
        504
      );
    }

    return jsonResponse(
      { error: "Something went wrong in AI Coach" },
      500
    );
  }
});
