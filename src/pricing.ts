// Claude Haiku 4.5 pricing per token (as of 2026-03)
export const HAIKU_PRICING = {
  inputPerToken: 0.25 / 1_000_000,
  outputPerToken: 1.25 / 1_000_000,
};

export function calculateCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * HAIKU_PRICING.inputPerToken + outputTokens * HAIKU_PRICING.outputPerToken;
}
