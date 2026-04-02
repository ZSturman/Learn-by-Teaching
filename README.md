# Teach-the-AI Student

A voice-first consumer MVP where people learn by teaching an AI student out loud.

## What it does

- lets the user choose a topic, starting student level, and interruption aggressiveness
- opens a browser-based voice session with an AI student over OpenAI Realtime WebRTC
- keeps a structured model of what the student thinks has been taught, what remains unclear, and how strong the teacher seems
- generates a lightweight reflection summary after each session
- stores sessions locally in IndexedDB on the current device

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Zustand for live session state
- `@openai/agents` realtime session management
- OpenAI Responses API for post-session summaries
- IndexedDB via `idb`
- Vitest for core domain tests

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create a local env file:

```bash
cp .env.example .env.local
```

3. Add your OpenAI API key to `.env.local`.

4. Start the app:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).

## Important notes

- Live voice and summary generation require `OPENAI_API_KEY`.
- Sessions are saved locally in the browser, not in a backend database.
- The MVP targets guided realtime voice, so interruptions happen at pause boundaries rather than full overlapping duplex speech.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:watch`
