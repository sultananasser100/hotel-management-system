import {
  ApiError,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type Part,
} from "@google/genai";
import { gemini, ASSISTANT_MODEL } from "@/lib/assistant/client";
import { ASSISTANT_SYSTEM_PROMPT } from "@/lib/assistant/system-prompt";
import { ASSISTANT_TOOLS, type AssistantUser } from "@/lib/assistant/tools";
import { can } from "@/lib/permissions";

export type AssistantMessage = { role: "user" | "assistant"; content: string };

export class AssistantNotConfiguredError extends Error {}

// Bounds the number of request/tool round trips for one user message, so a
// confused model can't loop indefinitely at the caller's expense.
const MAX_TOOL_ITERATIONS = 5;
// Client sends the full session history each turn (no server-side storage);
// cap how much of it we forward to bound token usage on long sessions.
const MAX_HISTORY_MESSAGES = 40;
const MAX_OUTPUT_TOKENS = 2048;

// Gemini accepts a standard JSON Schema directly via `parametersJsonSchema`,
// so the tool registry's existing schema objects are reused as-is.
const GEMINI_FUNCTION_DECLARATIONS: FunctionDeclaration[] = ASSISTANT_TOOLS.map((tool) => ({
  name: tool.name,
  description: tool.description,
  parametersJsonSchema: tool.input_schema,
}));

function findTool(name: string) {
  return ASSISTANT_TOOLS.find((tool) => tool.name === name);
}

// The Gemini free tier occasionally returns a transient "model overloaded"
// 503, even on otherwise-reliable models. One retry is enough to absorb that
// without turning this into general retry/backoff infrastructure.
const OVERLOAD_RETRY_DELAY_MS = 1000;

async function generateContentWithRetry(
  client: NonNullable<typeof gemini>,
  params: GenerateContentParameters,
): Promise<GenerateContentResponse> {
  try {
    return await client.models.generateContent(params);
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) {
      await new Promise((resolve) => setTimeout(resolve, OVERLOAD_RETRY_DELAY_MS));
      return client.models.generateContent(params);
    }
    throw error;
  }
}

async function runTool(call: FunctionCall, user: AssistantUser): Promise<Part> {
  const name = call.name ?? "";
  const toResponsePart = (response: Record<string, unknown>): Part => ({
    functionResponse: { name, id: call.id, response },
  });

  const tool = findTool(name);
  if (!tool) {
    return toResponsePart({ error: "Unknown tool." });
  }
  // Defense in depth: the page and the route handler already require
  // "aiAssistant" view access, but each tool also gates on the specific
  // resource it exposes in case assistant access is ever extended to a role
  // that shouldn't see everything it currently implies.
  if (!can(user.role, tool.resource, "view")) {
    return toResponsePart({ error: "You do not have permission to access this information." });
  }

  try {
    const result = await tool.handler(call.args ?? {}, user);
    return toResponsePart({ output: result });
  } catch (error) {
    console.error(`[assistant] tool "${tool.name}" failed:`, error);
    return toResponsePart({
      error:
        "This lookup failed unexpectedly. Tell the user this information isn't available right now.",
    });
  }
}

/**
 * Runs the read-only tool-use loop against Gemini and returns the final
 * answer text. Tool calls are resolved server-side, one request at a time,
 * up to MAX_TOOL_ITERATIONS — the client only ever sees the finished reply.
 */
export async function runAssistant(
  history: AssistantMessage[],
  user: AssistantUser,
): Promise<string> {
  if (!gemini) {
    throw new AssistantNotConfiguredError("The AI assistant is not configured.");
  }

  // Gemini uses "model" (not "assistant") for the model's turns.
  const contents: Content[] = history.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const isLastIteration = iteration === MAX_TOOL_ITERATIONS - 1;

    const response = await generateContentWithRetry(gemini, {
      model: ASSISTANT_MODEL,
      contents,
      config: {
        systemInstruction: ASSISTANT_SYSTEM_PROMPT,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        // The tool registry has no bound callables for the SDK to invoke on
        // its own — every call is resolved explicitly in the loop below.
        automaticFunctionCalling: { disable: true },
        // Omitting tools on the final allowed iteration forces a direct
        // answer instead of another function call.
        tools: isLastIteration
          ? undefined
          : [{ functionDeclarations: GEMINI_FUNCTION_DECLARATIONS }],
      },
    });

    const functionCalls = response.functionCalls;
    if (!functionCalls || functionCalls.length === 0) {
      return response.text ?? "I don't have a response for that.";
    }

    const modelContent: Content = response.candidates?.[0]?.content ?? {
      role: "model",
      parts: functionCalls.map((call) => ({ functionCall: call })),
    };
    contents.push(modelContent);

    const responseParts = await Promise.all(functionCalls.map((call) => runTool(call, user)));
    contents.push({ role: "user", parts: responseParts });
  }

  return "I wasn't able to finish looking that up. Please try rephrasing your question.";
}
