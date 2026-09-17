"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getSessionRecord } from "@/lib/client/session-db";
import type { SessionRecord } from "@/lib/domain/session-schemas";
import { deriveTeacherBand } from "@/lib/domain/teaching-state";
import {
  formatPercent,
  formatSessionDate,
  labelForInquisitiveness,
  labelForStartingLevel,
} from "@/lib/utils";

function SummaryCard({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent: string;
}) {
  return (
    <section className="rounded-[28px] border border-white/12 bg-[rgba(10,18,15,0.84)] p-5">
      <div className="flex items-center gap-3">
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <h2 className="text-sm uppercase tracking-[0.28em] text-[#f7edd2]">
          {title}
        </h2>
      </div>
      <ul className="mt-4 space-y-3 text-sm leading-7 text-[#c9c4b5]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function SessionSummaryScreen({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getSessionRecord(sessionId)
      .then((record) => {
        if (cancelled) {
          return;
        }

        if (!record) {
          setErrorMessage("This summary could not be found on this device.");
        } else {
          setSession(record);
        }

        setLoading(false);
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load the saved summary.",
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08120f] px-6 text-[#f7edd2]">
        Loading your reflection...
      </main>
    );
  }

  if (errorMessage || !session || !session.summary) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08120f] px-6">
        <div className="max-w-lg rounded-[32px] border border-white/12 bg-[rgba(14,24,20,0.9)] p-8 text-[#f7edd2]">
          <p className="text-2xl">{errorMessage ?? "Summary unavailable"}</p>
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

  const teacherBand = deriveTeacherBand(session.teacherModel);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(208,179,113,0.18),_transparent_24%),linear-gradient(180deg,_#07110e_0%,_#0b1612_40%,_#0f1c16_100%)] px-5 py-8 md:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-[34px] border border-white/12 bg-[rgba(10,18,15,0.84)] p-7 shadow-[0_30px_120px_rgba(0,0,0,0.2)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href="/"
                className="text-xs uppercase tracking-[0.28em] text-[#8f8a7d]"
              >
                Back home
              </Link>
              <h1 className="mt-3 text-4xl tracking-[-0.04em] text-[#fff5dc]">
                Reflection for {session.config.topic}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#c9c4b5]">
                Student started as {labelForStartingLevel(session.config.studentStartingLevel).toLowerCase()} and stayed{" "}
                {labelForInquisitiveness(session.config.inquisitiveness).toLowerCase()} throughout the session.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[#d0b371]/35 bg-[#d0b371]/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-[#f7edd2]">
                {teacherBand}
              </span>
              <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-[#8f8a7d]">
                Saved {formatSessionDate(session.updatedAt)}
              </span>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          <aside className="space-y-6">
            <section className="rounded-[28px] border border-white/12 bg-[rgba(10,18,15,0.84)] p-5">
              <p className="text-sm uppercase tracking-[0.28em] text-[#8f8a7d]">
                Session snapshot
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  ["Depth", session.teacherModel.depth],
                  ["Clarity", session.teacherModel.clarity],
                  ["Precision", session.teacherModel.precision],
                  ["Consistency", session.teacherModel.consistency],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-[20px] border border-white/10 bg-[rgba(255,255,255,0.02)] p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.22em] text-[#8f8a7d]">
                      {label}
                    </p>
                    <p className="mt-2 text-2xl text-[#fff5dc]">
                      {formatPercent(value as number)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/12 bg-[rgba(10,18,15,0.84)] p-5">
              <p className="text-sm uppercase tracking-[0.28em] text-[#8f8a7d]">
                Transcript density
              </p>
              <div className="mt-4 space-y-3 text-sm text-[#c9c4b5]">
                <p>{session.transcript.filter((turn) => turn.role === "teacher").length} teacher turns</p>
                <p>{session.transcript.filter((turn) => turn.role === "student").length} student turns</p>
                <p>
                  {session.summary.source === "model"
                    ? "Summary generated by gpt-5.4-mini."
                    : "Summary generated from local fallback heuristics."}
                </p>
              </div>
              <Link
                href={`/session/${session.id}`}
                className="mt-5 inline-flex rounded-full border border-[#6a8f80]/45 bg-[#6a8f80]/10 px-4 py-3 text-sm text-[#e3f5ea]"
              >
                Reopen teaching room
              </Link>
            </section>
          </aside>

          <section className="grid gap-6 sm:grid-cols-2">
            <SummaryCard
              title="What you explained well"
              items={session.summary.strengths}
              accent="#d0b371"
            />
            <SummaryCard
              title="Where the student got confused"
              items={session.summary.confusions}
              accent="#f08b74"
            />
            <SummaryCard
              title="Concepts to strengthen"
              items={session.summary.needsWork}
              accent="#89a78a"
            />
            <SummaryCard
              title="Good next teaching prompts"
              items={session.summary.nextTeachingPrompts}
              accent="#8eb9d2"
            />
          </section>
        </div>
      </div>
    </main>
  );
}
