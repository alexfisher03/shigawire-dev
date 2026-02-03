import { getBackendBaseUrl } from "./backend";

export interface Session {
  id: string;
  name: string;
  created_at?: string;
  sealed?: boolean;
}

export interface Event {
  id: string;
  sessionId: string;
  seq: number; // each event should have a place in a sequence
  method: string;
  url: string;
  status?: number;
  startedAt?: string; // RFC3339
  endedAt?: string; // RFC3339
  durationMs?: number; // not stored in the db, derived from start and end
  reqHeaders?: Record<string, string> | string;
  respHeaders?: Record<string, string> | string;
  reqBody?: string;
  respBody?: string;
  redactionApplied?: string;
}

export async function listSessions(): Promise<Session[]> {
  const base = getBackendBaseUrl();

  try {
    const response = await fetch(`${base}/api/v1/sessions`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return [];
  }
}

export async function getSession(id: string): Promise<Session | null> {
  const base = getBackendBaseUrl();

  try {
    const response = await fetch(`${base}/api/v1/sessions/${id}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching session detail:", error);
    return null;
  }
}

export async function getSessionEvents(id: string): Promise<Event[]> {
  const base = getBackendBaseUrl();

  try {
    const response = await fetch(`${base}/api/v1/sessions/${id}/events`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching events:", error);
    return [];
  }
}

export async function createSession(name: string): Promise<Session | null> {
  const base = getBackendBaseUrl();

  try {
    const response = await fetch(`${base}/api/v1/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      console.error("Failed to create session:", response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating session:", error);
    return null;
  }
}
