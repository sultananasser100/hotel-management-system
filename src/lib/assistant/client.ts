import { GoogleGenAI } from "@google/genai";

// No key configured (e.g. local dev before `.env` is filled in) -> `gemini`
// is null and callers must handle that explicitly, rather than the SDK
// silently falling back to ambient Google Cloud credentials that won't exist
// in a deployed environment.
const apiKey = process.env.GEMINI_API_KEY;

export const gemini = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const ASSISTANT_MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";
