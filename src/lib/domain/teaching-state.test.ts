import { describe, expect, it } from "vitest";

import { mergeTeachingState, updateTeacherModel } from "@/lib/domain/teaching-state";

describe("teaching state merge", () => {
  it("merges concepts and deduplicates repeated strings", () => {
    const merged = mergeTeachingState(
      {
        concepts: [{ name: "Photosynthesis", status: "partial" }],
        dependencies: [],
        unexplainedTerms: ["chlorophyll"],
        openQuestions: [],
        confusionMoments: [],
        likelyMisunderstandings: [],
        nextQuestionCandidates: [],
      },
      {
        depth: 0.4,
        clarity: 0.5,
        precision: 0.5,
        consistency: 0.5,
        exampleQuality: 0.4,
        confidenceEstimate: 0.45,
      },
      {
        concepts: [{ name: "Photosynthesis", status: "clear" }],
        dependencies: [{ from: "sunlight", to: "glucose" }],
        unexplainedTerms: ["chlorophyll", "stroma"],
        openQuestions: ["What role does water play?"],
        confusionMoments: [],
        likelyMisunderstandings: [],
        nextQuestionCandidates: ["Can you compare it to cellular respiration?"],
        interruptionIntent: "ask_next_turn",
      },
    );

    expect(merged.teachingState.concepts).toEqual([
      { name: "Photosynthesis", status: "clear", evidence: "" },
    ]);
    expect(merged.teachingState.unexplainedTerms).toEqual([
      "chlorophyll",
      "stroma",
    ]);
    expect(merged.teachingState.dependencies).toHaveLength(1);
  });

  it("updates teacher model with EWMA-style smoothing", () => {
    const next = updateTeacherModel(
      {
        depth: 0.3,
        clarity: 0.3,
        precision: 0.3,
        consistency: 0.3,
        exampleQuality: 0.3,
        confidenceEstimate: 0.3,
      },
      {
        concepts: [],
        dependencies: [],
        unexplainedTerms: [],
        openQuestions: [],
        confusionMoments: [],
        likelyMisunderstandings: [],
        nextQuestionCandidates: [],
        interruptionIntent: "ask_next_turn",
        teacherSignals: {
          clarity: 0.9,
          stepCompleteness: 0.8,
          precision: 0.7,
          crossConceptConnection: 0.8,
          repairAbility: 0.75,
          exampleQuality: 0.85,
          confidenceEstimate: 0.8,
        },
      },
    );

    expect(next.clarity).toBeGreaterThan(0.3);
    expect(next.depth).toBeGreaterThan(0.3);
    expect(next.exampleQuality).toBeGreaterThan(0.3);
  });
});
