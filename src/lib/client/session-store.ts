"use client";

import { create } from "zustand";

import type {
  ConnectionStatus,
  SessionRecord,
  SessionStatus,
  SessionSummary,
  TeachingStateDelta,
  TranscriptTurn,
} from "@/lib/domain/session-schemas";
import {
  buildCompactTeachingSnapshot,
  mergeTeachingState,
  patchSessionRecord,
} from "@/lib/domain/teaching-state";
import { saveSessionRecord } from "@/lib/client/session-db";

type SessionStore = {
  currentSession: SessionRecord | null;
  connectionStatus: ConnectionStatus;
  muted: boolean;
  errorMessage: string | null;
  hydrateSession: (session: SessionRecord) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setSessionStatus: (status: SessionStatus) => void;
  replaceTranscript: (transcript: TranscriptTurn[]) => void;
  mergeTeachingDelta: (delta: TeachingStateDelta) => void;
  setSummary: (summary: SessionSummary) => void;
  setMuted: (muted: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  reset: () => void;
  getCompactSnapshot: () => ReturnType<typeof buildCompactTeachingSnapshot> | null;
};

function persistSession(session: SessionRecord | null) {
  if (!session || typeof window === "undefined") {
    return;
  }

  void saveSessionRecord(session);
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  currentSession: null,
  connectionStatus: "idle",
  muted: false,
  errorMessage: null,
  hydrateSession(session) {
    set({
      currentSession: session,
      connectionStatus:
        session.status === "live" ? "listening" : "idle",
      muted: false,
      errorMessage: null,
    });
  },
  setConnectionStatus(status) {
    set({ connectionStatus: status });
  },
  setSessionStatus(status) {
    set((state) => {
      if (!state.currentSession) {
        return state;
      }

      const nextSession = patchSessionRecord(state.currentSession, { status });
      persistSession(nextSession);

      return { currentSession: nextSession };
    });
  },
  replaceTranscript(transcript) {
    set((state) => {
      if (!state.currentSession) {
        return state;
      }

      const nextSession = patchSessionRecord(state.currentSession, { transcript });
      persistSession(nextSession);

      return { currentSession: nextSession };
    });
  },
  mergeTeachingDelta(delta) {
    set((state) => {
      if (!state.currentSession) {
        return state;
      }

      const merged = mergeTeachingState(
        state.currentSession.teachingState,
        state.currentSession.teacherModel,
        delta,
      );

      const nextSession = patchSessionRecord(state.currentSession, {
        teachingState: merged.teachingState,
        teacherModel: merged.teacherModel,
      });

      persistSession(nextSession);

      return { currentSession: nextSession };
    });
  },
  setSummary(summary) {
    set((state) => {
      if (!state.currentSession) {
        return state;
      }

      const nextSession = patchSessionRecord(state.currentSession, {
        summary,
        status: "completed",
      });

      persistSession(nextSession);

      return {
        currentSession: nextSession,
        connectionStatus: "ended",
      };
    });
  },
  setMuted(muted) {
    set({ muted });
  },
  setErrorMessage(message) {
    set({ errorMessage: message });
  },
  reset() {
    set({
      currentSession: null,
      connectionStatus: "idle",
      muted: false,
      errorMessage: null,
    });
  },
  getCompactSnapshot() {
    const session = get().currentSession;

    if (!session) {
      return null;
    }

    return buildCompactTeachingSnapshot(
      session.teachingState,
      session.teacherModel,
    );
  },
}));
