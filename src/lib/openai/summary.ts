import type { SessionRecord } from "@/lib/domain/session-schemas";
import { buildCompactTeachingSnapshot } from "@/lib/domain/teaching-state";
import { formatTranscriptForModel } from "@/lib/domain/realtime-history";

export function buildSummaryInstructions() {
  return `
You are helping a learner reflect after teaching an AI student out loud.

Produce a short, supportive, honest summary.
- Focus on what the learner explained well.
- Surface where the student got confused.
- Identify likely weak understanding without sounding judgmental.
- Suggest crisp next teaching prompts that would deepen understanding.

Do not grade, score, or moralize.
Prefer specific observations grounded in the transcript and state snapshot.
`.trim();
}

export function buildSummaryInput(session: SessionRecord) {
  const snapshot = buildCompactTeachingSnapshot(
    session.teachingState,
    session.teacherModel,
  );

  return `
Session topic: ${session.config.topic}
Student starting level: ${session.config.studentStartingLevel}
Inquisitiveness: ${session.config.inquisitiveness}
Teacher model snapshot:
${JSON.stringify(session.teacherModel, null, 2)}

Teaching state snapshot:
${JSON.stringify(snapshot, null, 2)}

Transcript:
${formatTranscriptForModel(session.transcript)}
`.trim();
}
