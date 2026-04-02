import type { NextRequest } from "next/server";

import {
  realtimeBootstrapResponseSchema,
  sessionConfigSchema,
} from "@/lib/domain/session-schemas";
import {
  buildRealtimeBootstrap,
  buildRealtimeClientSecretRequest,
} from "@/lib/openai/realtime-session";
import { getOpenAIClient } from "@/lib/server/openai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedConfig = sessionConfigSchema.safeParse(body);

    if (!parsedConfig.success) {
      return Response.json(
        {
          error: "Invalid session configuration.",
          issues: parsedConfig.error.flatten(),
        },
        { status: 400 },
      );
    }

    const bootstrap = buildRealtimeBootstrap(parsedConfig.data);
    const client = getOpenAIClient();
    const clientSecretResponse = await client.realtime.clientSecrets.create(
      buildRealtimeClientSecretRequest(parsedConfig.data),
    );

    const payload = realtimeBootstrapResponseSchema.parse({
      ...bootstrap,
      clientSecret: clientSecretResponse.value,
      expiresAt: clientSecretResponse.expires_at,
    });

    return Response.json(payload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to start the realtime teaching session.";

    return Response.json({ error: message }, { status: 500 });
  }
}
