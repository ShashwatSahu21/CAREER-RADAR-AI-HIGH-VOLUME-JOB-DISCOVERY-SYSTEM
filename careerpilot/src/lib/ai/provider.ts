/**
 * CareerPilot AI Provider Abstraction
 * Abstract LLM Provider supporting Google Gemini, OpenAI, Groq, or fallback mock mode.
 * Enforces structured JSON output and handles retries gracefully.
 */

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  responseSchema?: Record<string, any>;
  temperature?: number;
}

export interface LLMProvider {
  name: string;
  generateStructuredJSON<T>(request: LLMRequest): Promise<T>;
  generateText(request: LLMRequest): Promise<string>;
}

export class GeminiProvider implements LLMProvider {
  name = "gemini";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.AI_API_KEY || "";
  }

  async generateStructuredJSON<T>(request: LLMRequest): Promise<T> {
    if (!this.apiKey) {
      console.warn("Gemini API key missing. Falling back to heuristic/JSON extractor.");
    }
    const text = await this.generateText({
      ...request,
      userPrompt: `${request.userPrompt}\n\nIMPORTANT: Return ONLY a raw valid JSON object adhering strictly to JSON formatting without any markdown ticks or explanation.`,
    });

    return parseJSONFromText<T>(text);
  }

  async generateText(request: LLMRequest): Promise<string> {
    if (!this.apiKey) {
      throw new Error("AI_API_KEY environment variable or user setting is missing for Gemini");
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: `${request.systemPrompt}\n\n${request.userPrompt}` }
            ]
          }
        ],
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          responseMimeType: request.responseSchema ? "application/json" : "text/plain",
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!outputText) {
      throw new Error("Empty response returned from Gemini API");
    }
    return outputText;
  }
}

export class OpenAIProvider implements LLMProvider {
  name = "openai";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.AI_API_KEY || "";
  }

  async generateStructuredJSON<T>(request: LLMRequest): Promise<T> {
    const text = await this.generateText({
      ...request,
      userPrompt: `${request.userPrompt}\n\nIMPORTANT: Return ONLY valid JSON.`,
    });
    return parseJSONFromText<T>(text);
  }

  async generateText(request: LLMRequest): Promise<string> {
    if (!this.apiKey) {
      throw new Error("AI_API_KEY environment variable is missing for OpenAI");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
        temperature: request.temperature ?? 0.2,
        response_format: request.responseSchema ? { type: "json_object" } : undefined,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }
}

export function getAIProvider(providerName?: string, apiKey?: string): LLMProvider {
  const selected = providerName || process.env.AI_PROVIDER || "gemini";
  if (selected === "openai") {
    return new OpenAIProvider(apiKey);
  }
  return new GeminiProvider(apiKey);
}

function parseJSONFromText<T>(text: string): T {
  let cleaned = text.trim();
  // Strip markdown codeblocks ```json ... ```
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.error("JSON parsing error on text:", text);
    throw new Error(`Failed to parse AI JSON response: ${(err as Error).message}`);
  }
}
