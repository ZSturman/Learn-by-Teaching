"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getSessionRecord, listSessionRecords, saveSessionRecord } from "@/lib/client/session-db";
import { useSessionStore } from "@/lib/client/session-store";
import {
  inquisitivenessLevels,
  sessionConfigSchema,
  studentStartingLevels,
  type SessionRecord,
} from "@/lib/domain/session-schemas";
import { createSessionRecord } from "@/lib/domain/teaching-state";
import {
  formatPercent,
  formatSessionDate,
  labelForInquisitiveness,
  labelForStartingLevel,
} from "@/lib/utils";

const studentLevelOptions = studentStartingLevels.map((value) => ({
  value,
  label: labelForStartingLevel(value),
}));

const inquisitivenessOptions = inquisitivenessLevels.map((value) => ({
  value,
  label: labelForInquisitiveness(value),
}));

function SessionHistoryCard({ session }: { session: SessionRecord }) {
  const summaryTarget =
    session.summary || session.status === "completed"
      ? `/summary/${session.id}`
      : `/session/${session.id}`;
  const strength =
    session.summary?.strengths[0] ??
    session.teachingState.concepts.find((concept) => concept.status === "clear")
      ?.name ??
    "No reflection yet";

  return (
    <Link
      href={summaryTarget}
      className="group rounded-[28px] border border-white/12 bg-[rgba(12,20,17,0.75)] p-5 transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#d0b371]/40"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#f7edd2]">{session.config.topic}</p>
        <span className="rounded-full border border-white/12 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#d0b371]">
          {session.status}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#c9c4b5]">
        {strength}
      </p>
      <div className="mt-4 flex items-center justify-between text-xs text-[#9f9a8c]">
        <span>{formatSessionDate(session.updatedAt)}</span>
        <span>
          clarity {formatPercent(session.teacherModel.clarity)}
        </span>
      </div>
    </Link>
  );
}

export function HomePage() {
  const router = useRouter();
  const hydrateSession = useSessionStore((state) => state.hydrateSession);
  const resetStore = useSessionStore((state) => state.reset);

  const [topic, setTopic] = useState("");
  const [studentStartingLevel, setStudentStartingLevel] = useState<
    (typeof studentStartingLevels)[number]
  >(
    studentStartingLevels[0],
  );
  const [inquisitiveness, setInquisitiveness] = useState<
    (typeof inquisitivenessLevels)[number]
  >(
    inquisitivenessLevels[1],
  );
  const [submitting, setSubmitting] = useState(false);
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    resetStore();
    void listSessionRecords()
      .then(setRecentSessions)
      .catch(() => setRecentSessions([]));
  }, [resetStore]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const config = sessionConfigSchema.parse({
        topic,
        studentStartingLevel,
        inquisitiveness,
        voiceStyle: "warm_curiosity",
        startedAt: new Date().toISOString(),
      });

      const session = createSessionRecord(config);
      session.status = "ready";
      await saveSessionRecord(session);
      hydrateSession(session);
      router.push(`/session/${session.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't create the session.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function resumeMostRecent() {
    if (recentSessions.length === 0) {
      return;
    }

    const session = await getSessionRecord(recentSessions[0].id);
    if (!session) {
      return;
    }

    hydrateSession(session);
    router.push(
      session.summary || session.status === "completed"
        ? `/summary/${session.id}`
        : `/session/${session.id}`,
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(208,179,113,0.22),_transparent_28%),radial-gradient(circle_at_80%_0%,_rgba(88,124,108,0.18),_transparent_26%),linear-gradient(180deg,_#07110e_0%,_#0b1612_42%,_#0f1c16_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(255,240,204,0.08),transparent)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-6 py-8 md:px-10 lg:flex-row lg:items-start lg:gap-12 lg:px-14">
        <section className="flex-1 pt-6 lg:sticky lg:top-8">
          <span className="inline-flex rounded-full border border-[#d0b371]/40 bg-[#d0b371]/10 px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-[#f7edd2]">
            Voice-first learning MVP
          </span>
          <h1 className="mt-6 max-w-3xl font-['Avenir_Next','Helvetica_Neue',sans-serif] text-5xl leading-[1.02] tracking-[-0.05em] text-[#fff5dc] sm:text-6xl">
            Learn deeper by teaching an AI student out loud.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#c9c4b5]">
            Instead of listening to an expert, you explain a topic to a believable
            learner. The student listens, gets curious, gets confused, and nudges
            you toward stronger understanding in realtime.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              "Choose any topic",
              "Teach with your voice",
              "Reflect on weak spots",
            ].map((label) => (
              <div
                key={label}
                className="rounded-[24px] border border-white/10 bg-[rgba(12,20,17,0.62)] p-4 text-sm text-[#d9d2c1] shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
              >
                {label}
              </div>
            ))}
          </div>

          {recentSessions.length > 0 ? (
            <div className="mt-10">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm uppercase tracking-[0.28em] text-[#a6a08f]">
                  Recent sessions
                </h2>
                <button
                  type="button"
                  onClick={resumeMostRecent}
                  className="rounded-full border border-[#d0b371]/35 px-4 py-2 text-xs font-medium text-[#f7edd2] transition hover:border-[#d0b371]/70"
                >
                  Open latest
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {recentSessions.slice(0, 4).map((session) => (
                  <SessionHistoryCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="w-full max-w-xl">
          <div className="rounded-[34px] border border-white/12 bg-[linear-gradient(180deg,rgba(20,32,26,0.92),rgba(10,18,15,0.94))] p-7 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-[#a6a08f]">
                  Start a session
                </p>
                <h2 className="mt-3 text-3xl leading-tight text-[#fff5dc]">
                  Set up the student you want to teach.
                </h2>
              </div>
              <div className="rounded-full border border-[#6a8f80]/45 bg-[#6a8f80]/10 px-4 py-2 text-xs text-[#dff4e7]">
                Local-first
              </div>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-sm font-medium text-[#f7edd2]">
                  What topic do you want to teach?
                </span>
                <textarea
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  className="mt-3 min-h-28 w-full rounded-[24px] border border-white/10 bg-[rgba(255,255,255,0.02)] px-5 py-4 text-base text-[#fff8e8] outline-none transition placeholder:text-[#8f8a7d] focus:border-[#d0b371]/55 focus:bg-[rgba(255,255,255,0.04)]"
                  placeholder="Examples: explain photosynthesis, teach me venture dilution, walk a student through SQL joins..."
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-[#f7edd2]">
                    Student starting level
                  </span>
                  <select
                    value={studentStartingLevel}
                    onChange={(event) =>
                      setStudentStartingLevel(
                        event.target.value as (typeof studentStartingLevels)[number],
                      )
                    }
                    className="mt-3 w-full rounded-[22px] border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[#fff8e8] outline-none focus:border-[#d0b371]/55"
                  >
                    {studentLevelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-[#f7edd2]">
                    Inquisitiveness
                  </span>
                  <select
                    value={inquisitiveness}
                    onChange={(event) =>
                      setInquisitiveness(
                        event.target.value as (typeof inquisitivenessLevels)[number],
                      )
                    }
                    className="mt-3 w-full rounded-[22px] border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[#fff8e8] outline-none focus:border-[#d0b371]/55"
                  >
                    {inquisitivenessOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[rgba(255,255,255,0.02)] p-5 text-sm text-[#cfc7b5]">
                <p className="font-medium text-[#fff5dc]">What happens next</p>
                <ul className="mt-3 space-y-2 leading-6">
                  <li>The student opens with one short learner-style question.</li>
                  <li>
                    It listens, updates a private model of what you seem to know,
                    and asks grounded follow-ups.
                  </li>
                  <li>
                    After the session, you get a reflection summary instead of a
                    score.
                  </li>
                </ul>
              </div>

              {errorMessage ? (
                <div className="rounded-[20px] border border-[#f08b74]/35 bg-[#f08b74]/10 px-4 py-3 text-sm text-[#ffd7cf]">
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#d0b371] px-6 py-4 text-base font-semibold text-[#192017] transition hover:bg-[#dcc18b] disabled:cursor-wait disabled:opacity-75"
              >
                {submitting ? "Creating session..." : "Open teaching room"}
              </button>
            </form>

            <p className="mt-5 text-xs leading-5 text-[#8f8a7d]">
              You will need an <code>OPENAI_API_KEY</code> in <code>.env.local</code>{" "}
              to run the live voice loop and summary generation.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
