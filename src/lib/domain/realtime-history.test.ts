import { describe, expect, it } from "vitest";

import { syncTranscriptFromRealtimeHistory } from "@/lib/domain/realtime-history";
import type { RealtimeItem } from "@openai/agents/realtime";

describe("syncTranscriptFromRealtimeHistory", () => {
  it("maps teacher and student items into transcript turns", () => {
    const history: RealtimeItem[] = [
      {
        itemId: "teacher-1",
        previousItemId: null,
        type: "message",
        role: "user",
        status: "completed",
        content: [
          {
            type: "input_audio",
            transcript: "Photosynthesis turns sunlight into stored chemical energy.",
          },
        ],
      },
      {
        itemId: "student-1",
        previousItemId: "teacher-1",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_audio",
            transcript: "Wait, what exactly is being stored?",
          },
        ],
      },
    ];

    const result = syncTranscriptFromRealtimeHistory(history, [], {});

    expect(result.transcript).toHaveLength(2);
    expect(result.transcript[0]?.role).toBe("teacher");
    expect(result.transcript[1]?.kind).toBe("student_interrupt");
  });
});
