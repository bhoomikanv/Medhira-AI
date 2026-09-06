// netlify/functions/chat.js
//
// Secure serverless proxy between Medhira AI's frontend and the
// Anthropic Claude API. The API key never reaches the browser:
// it is read here, server-side, from the Netlify environment
// variable ANTHROPIC_API_KEY.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

// Keep the request body reasonable and avoid sending unbounded history.
const MAX_HISTORY_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 8000;

exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (event.httpMethod !== "POST") {
    return respond(405, { error: "method_not_allowed" }, headers);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Medhira AI: ANTHROPIC_API_KEY is not set in the environment.");
    return respond(500, { error: "missing_key" }, headers);
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return respond(400, { error: "invalid_json" }, headers);
  }

  const { messages, system } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return respond(400, { error: "empty_messages" }, headers);
  }

  // Sanitize / clamp the conversation we forward to Claude.
  const cleanMessages = messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_LENGTH),
    }));

  if (cleanMessages.length === 0) {
    return respond(400, { error: "empty_messages" }, headers);
  }

  const systemPrompt =
    typeof system === "string" && system.trim().length > 0
      ? system.slice(0, 4000)
      : "You are Medhira AI, a helpful, intelligent, friendly, and respectful AI assistant.";

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: cleanMessages,
      }),
    });

    if (response.status === 429) {
      return respond(429, { error: "rate_limited" }, headers);
    }

    if (!response.ok) {
      let details = "";
      try {
        const errJson = await response.json();
        details = errJson?.error?.message || "";
      } catch {
        /* ignore parse failure */
      }
      console.error("Anthropic API error:", response.status, details);
      return respond(502, { error: "upstream_error" }, headers);
    }

    const data = await response.json();
    const textBlock = Array.isArray(data.content)
      ? data.content.find((block) => block.type === "text")
      : null;

    if (!textBlock || typeof textBlock.text !== "string") {
      return respond(502, { error: "invalid_upstream_response" }, headers);
    }

    return respond(200, { reply: textBlock.text }, headers);
  } catch (err) {
    console.error("Medhira AI function error:", err);
    return respond(500, { error: "server_error" }, headers);
  }
};

function respond(statusCode, bodyObj, headers) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(bodyObj),
  };
}
