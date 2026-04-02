"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getSessionRecord } from "@/lib/client/session-db";
import { useSessionStore } from "@/lib/client/session-store";
import { buildCompactTeachingSnapshot, deriveTeacherBand } from "@/lib/domain/teaching-state";
import type { SessionSummary } from "@/lib/domain/session-schemas";
import { VoiceSessionController } from "@/lib/realtime/voice-session-controller";
import {
  formatPercent,
  formatSessionDate,
  labelForConnectionStatus,
  labelForInquisitiveness,
  labelForStartingLevel,
} from "@/lib/utils";

function Meter({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-[#8f8a7d]">
        <span>{label}</span>
        <span>{formatPercent(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#d0b371,#89a78a)]"
          style={{ width: `${Math.max(8, Math.round(value * 100))}%` }}
        />
      </div>
    </div>
  );
}

export function LiveSessionScreen({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const controllerRef = useRef<VoiceSessionController | null>(null);

  const currentSession = useSessionStore((state) => state.currentSession);
  const connectionStatus = useSessionStore((state) => state.connectionStatus);
  const muted = useSessionStore((state) => state.muted);
  const errorMessage = useSessionStore((state) => state.errorMessage);
  const hydrateSession = useSessionStore((state) => state.hydrateSession);
  const setConnectionStatus = useSessionStore((state) => state.setConnectionStatus);
  const setSessionStatus = useSessionStore((state) => state.setSessionStatus);
  const replaceTranscript = useSessionStore((state) => state.replaceTranscript);
  const mergeTeachingDelta = useSessionStore((state) => state.mergeTeachingDelta);
  const setMuted = useSessionStore((state) => state.setMuted);
  const setErrorMessage = useSessionStore((state) => state.setErrorMessage);
  const setSummary = useSessionStore((state) => state.setSummary);
  const getCompactSnapshot = useSessionStore((state) => state.getCompactSnapshot);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getSessionRecord(sessionId)
      .then((session) => {
        if (cancelled) {
          return;
        }

        if (!session) {
          setLoadError("This session could not be found on this device.");
          setLoading(false);
          return;
        }

        hydrateSession(session);
        setLoading(false);
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Failed to load the saved session.",
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controllerRef.current?.close();
    };
  }, [hydrateSession, sessionId]);

  async function startVoiceSession() {
    if (!currentSession) {
      return;
    }

    setErrorMessage(null);
    controllerRef.current?.close();

    const controller = new VoiceSessionController({
      session: currentSession,
      getCompactSnapshot,
      onConnectionStatus: setConnectionStatus,
      onSessionStatus: setSessionStatus,
      onTranscript: replaceTranscript,
      onTeachingDelta: mergeTeachingDelta,
      onMutedChange: setMuted,
      onError: setErrorMessage,
    });

    controllerRef.current = controller;

    try {
      await controller.connect();
    } catch {
      controllerRef.current = null;
    }
  }

  async function endAndReflect() {
    const latestSession = useSessionStore.getState().currentSession;

    if (!latestSession) {
      return;
    }

    controllerRef.current?.close();
    setConnectionStatus("summarizing");
    setSessionStatus("summarizing");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/session/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: latestSession,
        }),
      });

      const payload = (await response.json()) as
        | { summary?: SessionSummary; error?: string }
        | undefined;

      if (!response.ok || !payload?.summary) {
        throw new Error(
          payload?.error ?? "We couldn't create the reflection summary.",
        );
      }

      setSummary(payload.summary);
      router.push(`/summary/${latestSession.id}`);
    } catch (error) {
      setConnectionStatus("error");
      setSessionStatus("failed");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't finish the session summary.",
      );
    }
  }

  function interruptStudent() {
    controllerRef.current?.interrupt();
  }

  function toggleMute() {
    controllerRef.current?.setMuted(!muted);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08120f] px-6 text-[#f7edd2]">
        Loading your teaching room...
      </main>
    );
  }

  if (loadError || !currentSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08120f] px-6">
        <div className="max-w-lg rounded-[32px] border border-white/12 bg-[rgba(14,24,20,0.9)] p-8 text-[#f7edd2]">
          <p className="text-2xl">{loadError ?? "Session unavailable"}</p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full border border-[#d0b371]/35 px-5 py-3 text-sm text-[#f7edd2]"
          >
            Back home
          </Link>
        </div>
      </main>
    );
  }

  const snapshot = buildCompactTeachingSnapshot(
    currentSession.teachingState,
    currentSession.teacherModel,
  );
  const teacherBand = deriveTeacherBand(currentSession.teacherModel);
  const canStart =
    connectionStatus === "idle" ||
    connectionStatus === "error" ||
    connectionStatus === "ended";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(208,179,113,0.18),_transparent_24%),linear-gradient(180deg,_#07110e_0%,_#0b1612_40%,_#0f1c16_100%)] px-5 py-6 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-[30px] border border-white/12 bg-[rgba(10,18,15,0.84)] px-6 py-5 shadow-[0_30px_120px_rgba(0,0,0,0.2)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <Link
                href="/"
                className="text-xs uppercase tracking-[0.28em] text-[#8f8a7d]"
              >
                Teach-the-AI Student
              </Link>
              <h1 className="mt-3 text-4xl tracking-[-0.04em] text-[#fff5dc]">
                {currentSession.config.topic}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c9c4b5]">
                Student starts at {labelForStartingLevel(currentSession.config.studentStartingLevel)} and stays{" "}
                {labelForInquisitiveness(currentSession.config.inquisitiveness).toLowerCase()}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[#d0b371]/35 bg-[#d0b371]/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-[#f7edd2]">
                {labelForConnectionStatus(connectionStatus)}
              </span>
              <span className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-[#8f8a7d]">
                {teacherBand}
              </span>
              <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-[#8f8a7d]">
                Created {formatSessionDate(currentSession.createdAt)}
              </span>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
          <section className="rounded-[30px] border border-white/12 bg-[rgba(10,18,15,0.82)] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-[#8f8a7d]">
                  Live transcript
                </p>
                <p className="mt-2 text-sm text-[#c9c4b5]">
                  Best sessions stay under 15 minutes and keep one thread moving.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={startVoiceSession}
                  disabled={!canStart}
                  className="rounded-full bg-[#d0b371] px-5 py-3 text-sm font-semibold text-[#1a2017] transition hover:bg-[#dcc18b] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {canStart ? "Start voice session" : "Session active"}
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  disabled={!controllerRef.current}
                  className="rounded-full border border-white/12 px-5 py-3 text-sm text-[#f7edd2] transition hover:border-[#d0b371]/55 disabled:opacity-50"
                >
                  {muted ? "Unmute mic" : "Mute mic"}
                </button>
                <button
                  type="button"
                  onClick={interruptStudent}
                  disabled={!controllerRef.current}
                  className="rounded-full border border-white/12 px-5 py-3 text-sm text-[#f7edd2] transition hover:border-[#d0b371]/55 disabled:opacity-50"
                >
                  Stop student
                </button>
                <button
                  type="button"
                  onClick={endAndReflect}
                  className="rounded-full border border-[#6a8f80]/45 bg-[#6a8f80]/10 px-5 py-3 text-sm font-medium text-[#e3f5ea] transition hover:border-[#6a8f80]/75"
                >
                  End &amp; reflect
                </button>
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-5 rounded-[22px] border border-[#f08b74]/35 bg-[#f08b74]/10 px-4 py-3 text-sm text-[#ffd7cf]">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-6 max-h-[68vh] space-y-3 overflow-y-auto pr-1">
              {currentSession.transcript.length === 0 ? (
                <div className="rounded-[26px] border border-dashed border-white/12 bg-[rgba(255,255,255,0.02)] px-5 py-10 text-center text-sm text-[#8f8a7d]">
                  Start the session to hear the student open with a question and
                  begin tracking your explanation.
                </div>
              ) : null}

              {currentSession.transcript.map((turn) => (
                <article
                  key={turn.id}
                  className={`rounded-[26px] border px-5 py-4 ${
                    turn.role === "teacher"
                      ? "ml-auto max-w-[88%] border-[#d0b371]/30 bg-[#d0b371]/10"
                      : turn.role === "student"
                        ? "mr-auto max-w-[88%] border-[#6a8f80]/35 bg-[#6a8f80]/10"
                        : "mx-auto max-w-[80%] border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] uppercase tracking-[0.28em] text-[#8f8a7d]">
                      {turn.role}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.22em] text-[#8f8a7d]">
                      {turn.kind.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="mt-3 text-[15px] leading-7 text-[#f7edd2]">
                    {turn.text}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[30px] border border-white/12 bg-[rgba(10,18,15,0.82)] p-5">
              <p className="text-sm uppercase tracking-[0.28em] text-[#8f8a7d]">
                Student model
              </p>
              <div className="mt-5 space-y-4">
                <Meter label="Depth" value={currentSession.teacherModel.depth} />
                <Meter label="Clarity" value={currentSession.teacherModel.clarity} />
                <Meter label="Precision" value={currentSession.teacherModel.precision} />
                <Meter label="Consistency" value={currentSession.teacherModel.consistency} />
                <Meter
                  label="Example quality"
                  value={currentSession.teacherModel.exampleQuality}
                />
              </div>
            </section>

            <section className="rounded-[30px] border border-white/12 bg-[rgba(10,18,15,0.82)] p-5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm uppercase tracking-[0.28em] text-[#8f8a7d]">
                  What the student thinks it knows
                </p>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#d0b371]">
                  {snapshot.teacherBand}
                </span>
              </div>

              <div className="mt-5 space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#8f8a7d]">
                    Strong concepts
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {snapshot.strongestConcepts.length > 0 ? (
                      snapshot.strongestConcepts.map((concept) => (
                        <span
                          key={concept.name}
                          className="rounded-full border border-[#6a8f80]/45 bg-[#6a8f80]/10 px-3 py-2 text-sm text-[#e3f5ea]"
                        >
                          {concept.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[#8f8a7d]">
                        Nothing feels settled yet.
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#8f8a7d]">
                    Shaky or incomplete
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {snapshot.shakyConcepts.length > 0 ? (
                      snapshot.shakyConcepts.map((concept) => (
                        <span
                          key={concept.name}
                          className="rounded-full border border-[#d0b371]/35 bg-[#d0b371]/10 px-3 py-2 text-sm text-[#f7edd2]"
                        >
                          {concept.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[#8f8a7d]">
                        No flagged gaps yet.
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#8f8a7d]">
                    Unexplained terms
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#c9c4b5]">
                    {snapshot.unexplainedTerms.length > 0
                      ? snapshot.unexplainedTerms.join(", ")
                      : "The student has not logged undefined jargon yet."}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#8f8a7d]">
                    Live open questions
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[#c9c4b5]">
                    {snapshot.openQuestions.length > 0 ? (
                      snapshot.openQuestions.map((question) => (
                        <li key={question}>{question}</li>
                      ))
                    ) : (
                      <li>No queued questions yet.</li>
                    )}
                  </ul>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
