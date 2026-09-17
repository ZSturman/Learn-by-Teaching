import { describe, expect, it } from "vitest";

import { buildRealtimeBootstrap } from "@/lib/openai/realtime-session";

describe("buildRealtimeBootstrap", () => {
  it("maps low inquisitiveness to a gentler turn detection preset", () => {
    const bootstrap = buildRealtimeBootstrap({
      topic: "SQL joins",
      studentStartingLevel: "absolute_beginner",
      inquisitiveness: "low",
      voiceStyle: "warm_curiosity",
      startedAt: new Date().toISOString(),
    });

    expect(bootstrap.model).toBe("gpt-realtime-1.5");
    expect(bootstrap.clientConfig.audio.input.turnDetection.eagerness).toBe("low");
  });

  it("maps high inquisitiveness to a faster interruption preset", () => {
    const bootstrap = buildRealtimeBootstrap({
      topic: "SQL joins",
      studentStartingLevel: "familiar_but_rusty",
      inquisitiveness: "high",
      voiceStyle: "warm_curiosity",
      startedAt: new Date().toISOString(),
    });

    expect(bootstrap.clientConfig.audio.input.turnDetection.eagerness).toBe("high");
    expect(bootstrap.instructions).toContain("Interrupt quickly");
  });
});
