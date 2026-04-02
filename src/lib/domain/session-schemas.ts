import { z } from "zod";

export const studentStartingLevels = [
  "absolute_beginner",
  "some_basics",
  "familiar_but_rusty",
] as const;

export const inquisitivenessLevels = ["low", "balanced", "high"] as const;

export const voiceStyles = ["warm_curiosity"] as const;

export const transcriptTurnKinds = [
  "teach",
  "student_question",
  "student_interrupt",
  "student_reflection",
  "system",
] as const;

export const sessionStatuses = [
  "draft",
  "ready",
  "connecting",
  "live",
  "summarizing",
  "completed",
  "failed",
] as const;

export const connectionStatuses = [
  "idle",
  "bootstrapping",
  "connecting",
  "listening",
  "thinking",
  "speaking",
  "summarizing",
  "error",
  "ended",
] as const;

export const conceptStatusSchema = z.enum(["clear", "partial", "unclear"]);
export const studentStartingLevelSchema = z.enum(studentStartingLevels);
export const inquisitivenessSchema = z.enum(inquisitivenessLevels);
export const voiceStyleSchema = z.enum(voiceStyles);
export const transcriptTurnKindSchema = z.enum(transcriptTurnKinds);
export const sessionStatusSchema = z.enum(sessionStatuses);
export const connectionStatusSchema = z.enum(connectionStatuses);

export const teachingConceptSchema = z.object({
  name: z.string().min(1),
  status: conceptStatusSchema,
  evidence: z.string().optional(),
});

export const conceptDependencySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

export const confusionMomentSchema = z.object({
  concept: z.string().optional(),
  kind: z.enum([
    "missing_explanation",
    "unclear_explanation",
    "likely_misunderstanding",
    "healthy_curiosity",
  ]),
  reason: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
});

export const likelyMisunderstandingSchema = z.object({
  concept: z.string().min(1),
  reason: z.string().min(1),
});

export const teacherModelSchema = z.object({
  depth: z.number().min(0).max(1),
  clarity: z.number().min(0).max(1),
  precision: z.number().min(0).max(1),
  consistency: z.number().min(0).max(1),
  exampleQuality: z.number().min(0).max(1),
  confidenceEstimate: z.number().min(0).max(1),
});

export const teachingStateSchema = z.object({
  concepts: z.array(teachingConceptSchema),
  dependencies: z.array(conceptDependencySchema),
  unexplainedTerms: z.array(z.string().min(1)),
  openQuestions: z.array(z.string().min(1)),
  confusionMoments: z.array(confusionMomentSchema),
  likelyMisunderstandings: z.array(likelyMisunderstandingSchema),
  nextQuestionCandidates: z.array(z.string().min(1)),
});

export const sessionConfigSchema = z.object({
  topic: z.string().min(3).max(160),
  studentStartingLevel: studentStartingLevelSchema.default("absolute_beginner"),
  inquisitiveness: inquisitivenessSchema.default("balanced"),
  voiceStyle: voiceStyleSchema.default("warm_curiosity"),
  startedAt: z.string().datetime(),
});

export const transcriptTurnSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["teacher", "student", "system"]),
  text: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  kind: transcriptTurnKindSchema,
});

export const sessionSummarySchema = z.object({
  strengths: z.array(z.string().min(1)).min(1),
  confusions: z.array(z.string().min(1)).min(1),
  needsWork: z.array(z.string().min(1)).min(1),
  nextTeachingPrompts: z.array(z.string().min(1)).min(1),
  source: z.enum(["model", "fallback"]).default("model"),
});

export const teachingSignalSchema = z.object({
  clarity: z.number().min(0).max(1),
  stepCompleteness: z.number().min(0).max(1),
  precision: z.number().min(0).max(1),
  crossConceptConnection: z.number().min(0).max(1),
  repairAbility: z.number().min(0).max(1),
  exampleQuality: z.number().min(0).max(1),
  confidenceEstimate: z.number().min(0).max(1),
  contradictionDetected: z.boolean().optional(),
});

export const teachingStateDeltaSchema = z.object({
  concepts: z.array(teachingConceptSchema).max(8).default([]),
  dependencies: z.array(conceptDependencySchema).max(10).default([]),
  unexplainedTerms: z.array(z.string().min(1)).max(8).default([]),
  openQuestions: z.array(z.string().min(1)).max(6).default([]),
  confusionMoments: z.array(confusionMomentSchema).max(6).default([]),
  likelyMisunderstandings: z
    .array(likelyMisunderstandingSchema)
    .max(6)
    .default([]),
  nextQuestionCandidates: z.array(z.string().min(1)).max(6).default([]),
  teacherSignals: teachingSignalSchema.optional(),
  interruptionIntent: z
    .enum(["none", "soft_interrupt", "ask_next_turn"])
    .default("ask_next_turn"),
  rationale: z.string().max(280).optional(),
});

export const sessionRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: sessionStatusSchema,
  config: sessionConfigSchema,
  transcript: z.array(transcriptTurnSchema),
  teachingState: teachingStateSchema,
  teacherModel: teacherModelSchema,
  summary: sessionSummarySchema.optional(),
});

export const realtimeBootstrapResponseSchema = z.object({
  clientSecret: z.string().min(1),
  expiresAt: z.number(),
  model: z.string().min(1),
  instructions: z.string().min(1),
  voice: z.string().min(1),
  kickoff: z.object({
    mode: z.enum(["request_response", "system_message"]),
    message: z.string().optional(),
  }),
  clientConfig: z.object({
    outputModalities: z.array(z.enum(["text", "audio"])),
    maxOutputTokens: z.union([z.number().int().positive(), z.literal("inf")]),
    audio: z.object({
      input: z.object({
        format: z.object({
          type: z.literal("audio/pcm"),
          rate: z.number().int().positive(),
        }),
        noiseReduction: z.object({
          type: z.enum(["near_field", "far_field"]),
        }),
        transcription: z.object({
          model: z.string().min(1),
        }),
        turnDetection: z.object({
          type: z.enum(["semantic_vad", "server_vad"]),
          createResponse: z.boolean(),
          interruptResponse: z.boolean(),
          eagerness: z.enum(["low", "medium", "high", "auto"]),
        }),
      }),
      output: z.object({
        voice: z.string().min(1),
      }),
    }),
  }),
});

export const summaryRequestSchema = z.object({
  session: sessionRecordSchema,
});

export const llmSummarySchema = z.object({
  explainedWell: z.array(z.string().min(1)).min(1),
  studentConfusions: z.array(z.string().min(1)).min(1),
  likelyWeakUnderstanding: z.array(z.string().min(1)).min(1),
  suggestedNextPrompts: z.array(z.string().min(1)).min(1),
});

export type StudentStartingLevel = z.infer<typeof studentStartingLevelSchema>;
export type Inquisitiveness = z.infer<typeof inquisitivenessSchema>;
export type VoiceStyle = z.infer<typeof voiceStyleSchema>;
export type SessionConfig = z.infer<typeof sessionConfigSchema>;
export type TeachingConcept = z.infer<typeof teachingConceptSchema>;
export type ConfusionMoment = z.infer<typeof confusionMomentSchema>;
export type TeachingState = z.infer<typeof teachingStateSchema>;
export type TeacherModel = z.infer<typeof teacherModelSchema>;
export type TeachingSignals = z.infer<typeof teachingSignalSchema>;
export type TeachingStateDelta = z.infer<typeof teachingStateDeltaSchema>;
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
export type SessionRecord = z.infer<typeof sessionRecordSchema>;
export type SessionStatus = z.infer<typeof sessionStatusSchema>;
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export type RealtimeBootstrapResponse = z.infer<
  typeof realtimeBootstrapResponseSchema
>;
