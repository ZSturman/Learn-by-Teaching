"use client";

import {
  RealtimeAgent,
  RealtimeSession,
  tool,
  type RealtimeItem,
} from "@openai/agents/realtime";
import { z } from "zod";

import {
  realtimeBootstrapResponseSchema,
  teachingStateDeltaSchema,
  type ConnectionStatus,
  type SessionRecord,
  type SessionStatus,
  type TeachingStateDelta,
  type TranscriptTurn,
} from "@/lib/domain/session-schemas";
import { syncTranscriptFromRealtimeHistory } from "@/lib/domain/realtime-history";

type VoiceSessionControllerOptions = {
  session: SessionRecord;
  getCompactSnapshot: () => unknown;
  onConnectionStatus: (status: ConnectionStatus) => void;
  onSessionStatus: (status: SessionStatus) => void;
  onTranscript: (transcript: TranscriptTurn[]) => void;
  onTeachingDelta: (delta: TeachingStateDelta) => void;
  onMutedChange: (muted: boolean) => void;
  onError: (message: string) => void;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Something went wrong during the voice session.";
}

export class VoiceSessionController {
  private readonly options: VoiceSessionControllerOptions;
  private realtimeSession: RealtimeSession | null = null;
  private transcript: TranscriptTurn[];
  private seenMap: Record<string, string>;
  private disposed = false;

  constructor(options: VoiceSessionControllerOptions) {
    this.options = options;
    this.transcript = options.session.transcript;
    this.seenMap = Object.fromEntries(
      options.session.transcript.map((turn) => [turn.id, turn.startedAt]),
    );
  }

  async connect() {
    this.options.onConnectionStatus("bootstrapping");
    this.options.onSessionStatus("connecting");

    try {
      const bootstrapResponse = await fetch("/api/realtime/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this.options.session.config),
      });

      if (!bootstrapResponse.ok) {
        const errorPayload = (await bootstrapResponse.json().catch(() => null)) as
          | { error?: string }
          | null;

        throw new Error(
          errorPayload?.error ?? "Failed to fetch realtime session bootstrap data.",
        );
      }

      const bootstrap = realtimeBootstrapResponseSchema.parse(
        await bootstrapResponse.json(),
      );

      const syncTeachingState = tool({
        name: "sync_teaching_state",
        description:
          "Update the student's internal model of what has been taught, where it is confused, and how strong the teacher currently seems.",
        parameters: teachingStateDeltaSchema,
        strict: true,
        execute: async (params) => {
          this.options.onTeachingDelta(params as z.infer<typeof teachingStateDeltaSchema>);

          return this.options.getCompactSnapshot();
        },
      });

      const agent = new RealtimeAgent({
        name: "Curious Student",
        voice: bootstrap.voice,
        instructions: bootstrap.instructions,
        tools: [syncTeachingState],
      });

      const realtimeSession = new RealtimeSession(agent, {
        transport: "webrtc",
        model: bootstrap.model,
        config: bootstrap.clientConfig,
        historyStoreAudio: false,
        tracingDisabled: true,
      });

      this.attachRealtimeListeners(realtimeSession);

      await realtimeSession.connect({
        apiKey: bootstrap.clientSecret,
        model: bootstrap.model,
      });

      this.realtimeSession = realtimeSession;
      this.options.onSessionStatus("live");

      if (bootstrap.kickoff.mode === "request_response") {
        (
          realtimeSession.transport as unknown as {
            requestResponse?: () => void;
          }
        ).requestResponse?.();
      } else if (bootstrap.kickoff.message) {
        realtimeSession.sendMessage(bootstrap.kickoff.message);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      this.options.onConnectionStatus("error");
      this.options.onSessionStatus("failed");
      this.options.onError(message);
      throw error;
    }
  }

  private attachRealtimeListeners(realtimeSession: RealtimeSession) {
    realtimeSession.transport.on("connection_change", (status) => {
      if (this.disposed) {
        return;
      }

      if (status === "connecting") {
        this.options.onConnectionStatus("connecting");
        return;
      }

      if (status === "connected") {
        this.options.onConnectionStatus("listening");
        return;
      }

      if (this.options.session.status !== "completed") {
        this.options.onConnectionStatus("ended");
      }
    });

    realtimeSession.on("agent_start", () => {
      if (!this.disposed) {
        this.options.onConnectionStatus("thinking");
      }
    });

    realtimeSession.on("audio_start", () => {
      if (!this.disposed) {
        this.options.onConnectionStatus("speaking");
      }
    });

    realtimeSession.on("audio_stopped", () => {
      if (!this.disposed) {
        this.options.onConnectionStatus("listening");
      }
    });

    realtimeSession.on("audio_interrupted", () => {
      if (!this.disposed) {
        this.options.onConnectionStatus("listening");
      }
    });

    realtimeSession.on("history_updated", (history: RealtimeItem[]) => {
      if (this.disposed) {
        return;
      }

      const next = syncTranscriptFromRealtimeHistory(
        history,
        this.transcript,
        this.seenMap,
      );

      this.transcript = next.transcript;
      this.seenMap = next.seenMap;
      this.options.onTranscript(next.transcript);
    });

    realtimeSession.on("error", ({ error }) => {
      if (this.disposed) {
        return;
      }

      this.options.onConnectionStatus("error");
      this.options.onError(getErrorMessage(error));
    });
  }

  interrupt() {
    this.realtimeSession?.interrupt();
    this.options.onConnectionStatus("listening");
  }

  setMuted(muted: boolean) {
    this.realtimeSession?.mute(muted);
    this.options.onMutedChange(muted);
  }

  close() {
    this.disposed = true;
    this.realtimeSession?.close();
    this.realtimeSession = null;
  }
}
