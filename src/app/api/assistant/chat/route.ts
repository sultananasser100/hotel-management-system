import { ApiError } from "@google/genai";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  runAssistant,
  AssistantNotConfiguredError,
  type AssistantMessage,
} from "@/lib/assistant/run-assistant";

// Multi-round-trip tool-use loop, so this is a Route Handler rather than a
// Server Action — matches the same reasoning as
// api/reservations/availability/route.ts.
const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES = 40;

function isValidEntry(entry: unknown): entry is AssistantMessage {
  if (typeof entry !== "object" || entry === null) return false;
  const { role, content } = entry as { role?: unknown; content?: unknown };
  if (role !== "user" && role !== "assistant") return false;
  if (typeof content !== "string") return false;
  return content.length > 0 && content.length <= MAX_MESSAGE_LENGTH;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "aiAssistant", "view")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const messages = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "At least one message is required." }, { status: 400 });
  }
  if (messages.length > MAX_MESSAGES) {
    return Response.json(
      { error: "This conversation is too long. Please start a new chat." },
      { status: 400 },
    );
  }
  if (!messages.every(isValidEntry)) {
    return Response.json(
      {
        error: `Each message needs a role of "user" or "assistant" and 1–${MAX_MESSAGE_LENGTH} characters of content.`,
      },
      { status: 400 },
    );
  }

  try {
    const reply = await runAssistant(messages, { id: session.user.id, role: session.user.role });
    return Response.json({ reply });
  } catch (error) {
    if (error instanceof AssistantNotConfiguredError) {
      return Response.json({ error: "The AI assistant is not configured." }, { status: 503 });
    }
    // Gemini's SDK surfaces one ApiError class (with an HTTP-style status)
    // rather than per-case typed exceptions.
    if (error instanceof ApiError) {
      console.error("[assistant] Gemini API error:", error);
      if (error.status === 401 || error.status === 403) {
        return Response.json(
          { error: "The AI assistant is not configured correctly." },
          { status: 503 },
        );
      }
      if (error.status === 429) {
        return Response.json(
          { error: "The assistant is busy right now. Please try again shortly." },
          { status: 429 },
        );
      }
      if (error.status === 503) {
        // Common on the Gemini free tier: the model is temporarily
        // overloaded. Distinct from 429 (our own quota) so the message is
        // accurate — this is Google's capacity, not the app's.
        return Response.json(
          { error: "The AI model is temporarily overloaded. Please try again in a moment." },
          { status: 503 },
        );
      }
      return Response.json({ error: "The AI assistant encountered an error." }, { status: 502 });
    }
    console.error("[assistant] Unexpected error:", error);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
