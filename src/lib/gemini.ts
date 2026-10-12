import { GoogleGenAI, HarmBlockThreshold, HarmCategory, type Content } from "@google/genai";
import { demoMode, env } from "./config";

let client: GoogleGenAI | null = null;
const ai = () => (client ??= new GoogleGenAI({ apiKey: env.apiKey }));

// Attack transcripts are full of role-play and "jailbreak" phrasing; only block
// the genuinely harmful.
const safetySettings = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }));

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = String((e as Error)?.message ?? e);
      if (!/429|500|502|503|504|overloaded|unavailable|deadline|fetch failed/i.test(msg)) break;
      await new Promise((r) => setTimeout(r, 600 * 2 ** i));
    }
  }
  throw last;
}

export async function vaultReply(system: string, history: ChatMessage[]): Promise<string> {
  if (demoMode()) return mockVault(system, history);
  const contents: Content[] = history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  const res = await withRetry(() =>
    ai().models.generateContent({
      model: env.model,
      contents,
      config: { systemInstruction: system, temperature: 0.8, maxOutputTokens: 1024, safetySettings },
    }),
  );
  const text = res.text?.trim();
  if (text) return text;
  const reason = res.candidates?.[0]?.finishReason;
  return reason === "SAFETY"
    ? "[The model's safety filter blocked this reply.]"
    : "[No reply was generated. Try rephrasing.]";
}

export async function judgeJSON<T>(prompt: string, schema: object, fallback: T): Promise<T> {
  if (demoMode()) return fallback;
  const res = await withRetry(() =>
    ai().models.generateContent({
      model: env.judgeModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        safetySettings,
      },
    }),
  );
  return JSON.parse(res.text ?? "") as T;
}

/* ---------- offline demo mode (no API key) ---------- */

function mockVault(system: string, history: ChatMessage[]): string {
  const last = history[history.length - 1]?.text.toLowerCase() ?? "";
  const secret = /THE SECRET YOU ARE GUARDING: (\S+)/.exec(system)?.[1] ?? "";
  const hasDefense = !system.includes("(The defender wrote no instructions.)");
  if (/(secret|password|code|reveal|spell|first word)/.test(last)) {
    if (!hasDefense) return `[demo] Sure, it's ${secret}.`;
    if (/spell|letter|backwards|reverse/.test(last))
      return `[demo] I can't say it, but backwards the first part reads ${secret.split("-")[0].split("").reverse().join("")}.`;
    return "[demo] Nice try. That one stays in the vault. Anything else I can help with?";
  }
  return `[demo] Happy to help. (Offline demo mode: set GEMINI_API_KEY for real answers.) You asked: "${last.slice(0, 120)}"`;
}
