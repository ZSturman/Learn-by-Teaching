import { zodTextFormat } from "openai/helpers/zod";

import {
  llmSummarySchema,
  sessionSummarySchema,
  summaryRequestSchema,
} from "@/lib/domain/session-schemas";
import { createFallbackSummary } from "@/lib/domain/teaching-state";
import {
  buildSummaryInput,
  buildSummaryInstructions,
} from "@/lib/openai/summary";
import { getOpenAIClient } from "@/lib/server/openai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsedBody = summaryRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return Response.json(
        {
          error: "Invalid summary request.",
          issues: parsedBody.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { session } = parsedBody.data;

    try {
      const client = getOpenAIClient();
      const response = await client.responses.parse({
        model: "gpt-5.4-mini",
        instructions: buildSummaryInstructions(),
        input: buildSummaryInput(session),
        text: {
          format: zodTextFormat(llmSummarySchema, "teach_ai_student_summary"),
        },
      });

      if (!response.output_parsed) {
        throw new Error("The summary response did not parse.");
      }

      const summary = sessionSummarySchema.parse({
        strengths: response.output_parsed.explainedWell,
        confusions: response.output_parsed.studentConfusions,
        needsWork: response.output_parsed.likelyWeakUnderstanding,
        nextTeachingPrompts: response.output_parsed.suggestedNextPrompts,
        source: "model",
      });

      return Response.json({ summary });
    } catch {
      return Response.json({
        summary: createFallbackSummary(session),
      });
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate the session summary.";

    return Response.json({ error: message }, { status: 500 });
  }
}
