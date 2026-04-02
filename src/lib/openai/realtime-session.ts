import type OpenAI from "openai";

import type {
  Inquisitiveness,
  RealtimeBootstrapResponse,
  SessionConfig,
} from "@/lib/domain/session-schemas";
import { buildStudentInstructions, getInquisitivenessProfile } from "@/lib/openai/student-instructions";

const MODEL = "gpt-realtime-1.5";
const STUDENT_VOICE = "verse";

function buildClientTurnDetection(inquisitiveness: Inquisitiveness) {
  const profile = getInquisitivenessProfile(inquisitiveness);

  return {
    type: "semantic_vad" as const,
    createResponse: true,
    interruptResponse: true,
    eagerness: profile.eagerness,
  };
}

function buildServerTurnDetection(inquisitiveness: Inquisitiveness) {
  const profile = getInquisitivenessProfile(inquisitiveness);

  return {
    type: "semantic_vad" as const,
    create_response: true,
    interrupt_response: true,
    eagerness: profile.eagerness,
  };
}

export function buildRealtimeBootstrap(config: SessionConfig): RealtimeBootstrapResponse {
  return {
    clientSecret: "",
    expiresAt: 0,
    model: MODEL,
    instructions: buildStudentInstructions(config),
    voice: STUDENT_VOICE,
    kickoff: {
      mode: "request_response",
    },
    clientConfig: {
      outputModalities: ["audio"],
      maxOutputTokens: 220,
      audio: {
        input: {
          format: {
            type: "audio/pcm",
            rate: 24000,
          },
          noiseReduction: {
            type: "near_field",
          },
          transcription: {
            model: "gpt-4o-mini-transcribe",
          },
          turnDetection: buildClientTurnDetection(config.inquisitiveness),
        },
        output: {
          voice: STUDENT_VOICE,
        },
      },
    },
  };
}

export function buildRealtimeClientSecretRequest(
  config: SessionConfig,
): OpenAI.Realtime.ClientSecretCreateParams {
  const bootstrap = buildRealtimeBootstrap(config);

  return {
    expires_after: {
      anchor: "created_at",
      seconds: 600,
    },
    session: {
      type: "realtime",
      model: bootstrap.model,
      instructions: bootstrap.instructions,
      output_modalities: ["audio"],
      max_output_tokens: 220,
      audio: {
        input: {
          format: {
            type: "audio/pcm",
            rate: 24000,
          },
          noise_reduction: {
            type: "near_field",
          },
          transcription: {
            model: "gpt-4o-mini-transcribe",
          },
          turn_detection: buildServerTurnDetection(config.inquisitiveness),
        },
        output: {
          voice: STUDENT_VOICE,
        },
      },
    },
  };
}
