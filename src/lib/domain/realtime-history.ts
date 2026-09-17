import type { RealtimeItem } from "@openai/agents/realtime";

import type { TranscriptTurn } from "@/lib/domain/session-schemas";

type SeenMap = Record<string, string>;

function extractItemText(item: RealtimeItem) {
  if (item.type !== "message") {
    return "";
  }

  if (item.role === "system") {
    return item.content.map((entry) => entry.text).join(" ").trim();
  }

  if (item.role === "user") {
    return item.content
      .map((entry) => {
        if (entry.type === "input_text") {
          return entry.text;
        }

        return entry.transcript ?? "";
      })
      .join(" ")
      .trim();
  }

  return item.content
    .map((entry) => {
      if (entry.type === "output_text") {
        return entry.text;
      }

      return entry.transcript ?? "";
    })
    .join(" ")
    .trim();
}

function inferStudentTurnKind(text: string): TranscriptTurn["kind"] {
  const normalized = text.trim().toLowerCase();

  if (
    normalized.startsWith("wait") ||
    normalized.startsWith("hold on") ||
    normalized.startsWith("i'm lost") ||
    normalized.startsWith("i am lost") ||
    normalized.startsWith("i'm confused") ||
    normalized.startsWith("i am confused")
  ) {
    return "student_interrupt";
  }

  if (normalized.includes("?")) {
    return "student_question";
  }

  return "student_reflection";
}

export function syncTranscriptFromRealtimeHistory(
  history: RealtimeItem[],
  existingTurns: TranscriptTurn[],
  seenMap: SeenMap,
) {
  const existingById = new Map(existingTurns.map((turn) => [turn.id, turn]));
  const nextSeenMap = { ...seenMap };
  const transcript: TranscriptTurn[] = [];

  for (const item of history) {
    if (item.type !== "message") {
      continue;
    }

    const text = extractItemText(item);
    if (!text) {
      continue;
    }

    const existing = existingById.get(item.itemId);
    const startedAt =
      existing?.startedAt ??
      nextSeenMap[item.itemId] ??
      new Date().toISOString();

    nextSeenMap[item.itemId] = startedAt;

    if (item.role === "system") {
      transcript.push({
        id: item.itemId,
        role: "system",
        text,
        startedAt,
        endedAt: startedAt,
        kind: "system",
      });
      continue;
    }

    if (item.role === "user") {
      transcript.push({
        id: item.itemId,
        role: "teacher",
        text,
        startedAt,
        endedAt: item.status === "completed" ? existing?.endedAt ?? new Date().toISOString() : undefined,
        kind: "teach",
      });
      continue;
    }

    transcript.push({
      id: item.itemId,
      role: "student",
      text,
      startedAt,
      endedAt:
        item.status === "completed" || item.status === "incomplete"
          ? existing?.endedAt ?? new Date().toISOString()
          : undefined,
      kind: inferStudentTurnKind(text),
    });
  }

  return {
    transcript,
    seenMap: nextSeenMap,
  };
}

export function formatTranscriptForModel(transcript: TranscriptTurn[]) {
  return transcript
    .map((turn, index) => `${index + 1}. [${turn.role}] ${turn.text}`)
    .join("\n");
}
