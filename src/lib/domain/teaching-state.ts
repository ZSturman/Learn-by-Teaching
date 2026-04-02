import type {
  SessionConfig,
  SessionRecord,
  SessionSummary,
  TeachingState,
  TeachingStateDelta,
  TeacherModel,
} from "@/lib/domain/session-schemas";

export const TEACHER_SIGNAL_WEIGHT = 0.28;

const nowIso = () => new Date().toISOString();

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const ewma = (previous: number, next: number, weight = TEACHER_SIGNAL_WEIGHT) =>
  clamp01(previous * (1 - weight) + next * weight);

const dedupeStrings = (values: string[]) =>
  Array.from(
    new Map(
      values
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => [value.toLowerCase(), value]),
    ).values(),
  );

const conceptStatusRank = {
  unclear: 0,
  partial: 1,
  clear: 2,
} as const;

export function createEmptyTeachingState(): TeachingState {
  return {
    concepts: [],
    dependencies: [],
    unexplainedTerms: [],
    openQuestions: [],
    confusionMoments: [],
    likelyMisunderstandings: [],
    nextQuestionCandidates: [],
  };
}

export function createEmptyTeacherModel(): TeacherModel {
  return {
    depth: 0.35,
    clarity: 0.4,
    precision: 0.4,
    consistency: 0.45,
    exampleQuality: 0.35,
    confidenceEstimate: 0.4,
  };
}

export function createSessionRecord(config: SessionConfig): SessionRecord {
  const timestamp = nowIso();

  return {
    id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "draft",
    config,
    transcript: [],
    teachingState: createEmptyTeachingState(),
    teacherModel: createEmptyTeacherModel(),
  };
}

function mergeConcepts(
  current: TeachingState["concepts"],
  incoming: TeachingStateDelta["concepts"],
) {
  const conceptMap = new Map(
    current.map((concept) => [concept.name.toLowerCase(), concept]),
  );

  for (const concept of incoming) {
    const key = concept.name.toLowerCase();
    const existing = conceptMap.get(key);

    if (!existing) {
      conceptMap.set(key, concept);
      continue;
    }

    const nextStatus =
      conceptStatusRank[concept.status] >= conceptStatusRank[existing.status]
        ? concept.status
        : existing.status;

    conceptMap.set(key, {
      name: existing.name,
      status: nextStatus,
      evidence: [existing.evidence, concept.evidence].filter(Boolean).join(" | "),
    });
  }

  return Array.from(conceptMap.values());
}

function mergeDependencies(
  current: TeachingState["dependencies"],
  incoming: TeachingStateDelta["dependencies"],
) {
  return Array.from(
    new Map(
      [...current, ...incoming].map((dependency) => [
        `${dependency.from.toLowerCase()}=>${dependency.to.toLowerCase()}`,
        dependency,
      ]),
    ).values(),
  );
}

function mergeConfusionMoments(
  current: TeachingState["confusionMoments"],
  incoming: TeachingStateDelta["confusionMoments"],
) {
  return Array.from(
    new Map(
      [...current, ...incoming].map((moment) => [
        `${moment.kind}:${moment.concept ?? ""}:${moment.reason.toLowerCase()}`,
        moment,
      ]),
    ).values(),
  ).slice(-12);
}

function mergeLikelyMisunderstandings(
  current: TeachingState["likelyMisunderstandings"],
  incoming: TeachingStateDelta["likelyMisunderstandings"],
) {
  return Array.from(
    new Map(
      [...current, ...incoming].map((item) => [
        `${item.concept.toLowerCase()}:${item.reason.toLowerCase()}`,
        item,
      ]),
    ).values(),
  ).slice(-10);
}

export function updateTeacherModel(
  current: TeacherModel,
  delta: TeachingStateDelta,
): TeacherModel {
  if (!delta.teacherSignals) {
    return current;
  }

  const {
    clarity,
    stepCompleteness,
    precision,
    crossConceptConnection,
    repairAbility,
    exampleQuality,
    confidenceEstimate,
    contradictionDetected,
  } = delta.teacherSignals;

  const depthSignal =
    (stepCompleteness + crossConceptConnection + precision) / 3;
  const consistencySignal = contradictionDetected
    ? 0.18
    : (repairAbility + precision) / 2;

  return {
    depth: ewma(current.depth, depthSignal),
    clarity: ewma(current.clarity, clarity),
    precision: ewma(current.precision, precision),
    consistency: ewma(current.consistency, consistencySignal),
    exampleQuality: ewma(current.exampleQuality, exampleQuality),
    confidenceEstimate: ewma(current.confidenceEstimate, confidenceEstimate),
  };
}

export function mergeTeachingState(
  currentState: TeachingState,
  currentTeacherModel: TeacherModel,
  delta: TeachingStateDelta,
) {
  const nextTeachingState: TeachingState = {
    concepts: mergeConcepts(currentState.concepts, delta.concepts),
    dependencies: mergeDependencies(currentState.dependencies, delta.dependencies),
    unexplainedTerms: dedupeStrings([
      ...currentState.unexplainedTerms,
      ...delta.unexplainedTerms,
    ]).slice(-12),
    openQuestions: dedupeStrings([
      ...currentState.openQuestions,
      ...delta.openQuestions,
    ]).slice(-10),
    confusionMoments: mergeConfusionMoments(
      currentState.confusionMoments,
      delta.confusionMoments,
    ),
    likelyMisunderstandings: mergeLikelyMisunderstandings(
      currentState.likelyMisunderstandings,
      delta.likelyMisunderstandings,
    ),
    nextQuestionCandidates: dedupeStrings([
      ...currentState.nextQuestionCandidates,
      ...delta.nextQuestionCandidates,
    ]).slice(-10),
  };

  return {
    teachingState: nextTeachingState,
    teacherModel: updateTeacherModel(currentTeacherModel, delta),
  };
}

export function deriveTeacherBand(teacherModel: TeacherModel) {
  const average =
    (teacherModel.depth +
      teacherModel.clarity +
      teacherModel.precision +
      teacherModel.consistency) /
    4;

  if (average < 0.42) {
    return "foundational";
  }

  if (average < 0.72) {
    return "connected";
  }

  return "advanced";
}

export function buildCompactTeachingSnapshot(
  teachingState: TeachingState,
  teacherModel: TeacherModel,
) {
  return {
    teacherBand: deriveTeacherBand(teacherModel),
    strongestConcepts: teachingState.concepts
      .filter((concept) => concept.status === "clear")
      .slice(0, 5),
    shakyConcepts: teachingState.concepts
      .filter((concept) => concept.status !== "clear")
      .slice(0, 5),
    unexplainedTerms: teachingState.unexplainedTerms.slice(0, 6),
    openQuestions: teachingState.openQuestions.slice(0, 5),
    likelyMisunderstandings: teachingState.likelyMisunderstandings.slice(0, 4),
    nextQuestionCandidates: teachingState.nextQuestionCandidates.slice(0, 4),
    teacherModel,
  };
}

export function createFallbackSummary(session: SessionRecord): SessionSummary {
  const strongConcepts =
    session.teachingState.concepts
      .filter((concept) => concept.status === "clear")
      .map((concept) => `You made ${concept.name} feel understandable.`)
      .slice(0, 3) ?? [];

  const confusions = [
    ...session.teachingState.confusionMoments.map((moment) =>
      moment.concept
        ? `The student lost the thread around ${moment.concept}: ${moment.reason}`
        : moment.reason,
    ),
    ...session.teachingState.unexplainedTerms.map(
      (term) => `The student heard ${term} before it was defined clearly.`,
    ),
  ].slice(0, 4);

  const needsWork = [
    ...session.teachingState.likelyMisunderstandings.map(
      (item) => `${item.concept} may still be shaky because ${item.reason}`,
    ),
    ...session.teachingState.concepts
      .filter((concept) => concept.status !== "clear")
      .map(
        (concept) =>
          `${concept.name} still felt ${concept.status === "partial" ? "half-explained" : "unclear"}.`,
      ),
  ].slice(0, 4);

  const nextTeachingPrompts = (
    session.teachingState.nextQuestionCandidates.length > 0
      ? session.teachingState.nextQuestionCandidates
      : [
          `Teach ${session.config.topic} again, but define the key terms before using them.`,
          `Explain ${session.config.topic} using one concrete example and one edge case.`,
          `Teach ${session.config.topic} as if the student has forgotten one prerequisite.`,
        ]
  ).slice(0, 4);

  return {
    strengths:
      strongConcepts.length > 0
        ? strongConcepts
        : ["You stayed engaged and kept the explanation moving."],
    confusions:
      confusions.length > 0
        ? confusions
        : ["The student did not log a specific confusion before the session ended."],
    needsWork:
      needsWork.length > 0
        ? needsWork
        : ["There was not enough evidence to identify one clear weak concept."],
    nextTeachingPrompts,
    source: "fallback",
  };
}

export function patchSessionRecord(
  session: SessionRecord,
  patch: Partial<SessionRecord>,
): SessionRecord {
  return {
    ...session,
    ...patch,
    updatedAt: nowIso(),
  };
}
