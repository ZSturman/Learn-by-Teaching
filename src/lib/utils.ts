import clsx, { type ClassValue } from "clsx";

import type {
  ConnectionStatus,
  Inquisitiveness,
  StudentStartingLevel,
} from "@/lib/domain/session-schemas";

export function cn(...values: ClassValue[]) {
  return clsx(values);
}

export function formatSessionDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function labelForStartingLevel(value: StudentStartingLevel) {
  switch (value) {
    case "absolute_beginner":
      return "Absolute beginner";
    case "some_basics":
      return "Some basics";
    case "familiar_but_rusty":
      return "Familiar but rusty";
  }
}

export function labelForInquisitiveness(value: Inquisitiveness) {
  switch (value) {
    case "low":
      return "Low interruption";
    case "balanced":
      return "Balanced";
    case "high":
      return "Highly inquisitive";
  }
}

export function labelForConnectionStatus(value: ConnectionStatus) {
  switch (value) {
    case "idle":
      return "Ready";
    case "bootstrapping":
      return "Preparing";
    case "connecting":
      return "Connecting";
    case "listening":
      return "Listening";
    case "thinking":
      return "Thinking";
    case "speaking":
      return "Speaking";
    case "summarizing":
      return "Summarizing";
    case "error":
      return "Needs attention";
    case "ended":
      return "Ended";
  }
}
