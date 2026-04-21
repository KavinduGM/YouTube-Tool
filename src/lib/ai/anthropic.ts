import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — configure it in Settings or the .env file"
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

/** Current default model. Using a cost-efficient, fast Sonnet tier. */
export const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

/**
 * Centralized helper for single-turn text completions. Caller passes a
 * fully-formed system + user prompt and we return the assistant's text.
 */
export async function chatOnce(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  /** If set, enable prompt caching on the system block (static context). */
  cacheSystem?: boolean;
}): Promise<{ text: string; usage: { input: number; output: number } }> {
  const client = getAnthropic();

  const system = opts.cacheSystem
    ? [{ type: "text" as const, text: opts.system, cache_control: { type: "ephemeral" as const } }]
    : opts.system;

  const res = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? 1500,
    system,
    messages: [{ role: "user", content: opts.user }],
  });

  const text = res.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("\n");

  return {
    text,
    usage: {
      input: res.usage.input_tokens,
      output: res.usage.output_tokens,
    },
  };
}
