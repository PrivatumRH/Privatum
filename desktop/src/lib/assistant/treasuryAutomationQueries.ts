import { buildTreasuryAutomationPlan, parseTreasuryAutomationPrompt, type TreasuryAutomationContext } from "../treasuryAutomation";
import type { ParsedTreasuryAutomationIntent } from "./types";

export function evaluateTreasuryAutomationQuery(input: string, context: TreasuryAutomationContext): { handled: true; summary: string; details: string[]; intent: ParsedTreasuryAutomationIntent } | null {
  const request = parseTreasuryAutomationPrompt(input);
  if (!request) return null;
  const plan = buildTreasuryAutomationPlan(request, context);
  return {
    handled: true,
    summary: plan.summary,
    details: plan.steps.map((step) => `${step.status.toUpperCase()}: ${step.title} — ${step.detail}`),
    intent: { type: "treasury_automation", plan },
  };
}
