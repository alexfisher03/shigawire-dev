import { getBackendBaseUrl } from "./backend";

export interface ProjectConfig {
  targetName?: string;
  targetHost?: string;
  targetPort?: number;
  targetScheme?: 'http' | 'https';
}

export interface Project {
  id: string;
  name: string;
  config_json: string; // The backend returns this as a stringified JSON
  created_at: string;
}

export interface Session {
  id: string;
  project_id: string;
  name: string;
  created_at?: string;
  sealed?: boolean;
  projectName?: string;
}

export interface Event {
  id: string;
  session_id: string;
  seq: number;
  method?: string;
  url?: string;
  status?: number;
  started_at?: string;
  ended_at?: string;
  durationMs?: number; // derived
  req_headers?: Record<string, string[]>;
  resp_headers?: Record<string, string[]>;
  req_body?: string;
  resp_body?: string;
  req_body_encoding?: string;
  resp_body_encoding?: string;
  req_body_b64?: string;
  resp_body_b64?: string;
  req_body_truncated?: boolean;
  resp_body_truncated?: boolean;
  redaction_applied?: string;
}

export interface RecordingStatus {
  recording: boolean;
  project_id: string;
  session_id: string;
}

// --- Project API ---

export async function listProjects(): Promise<Project[]> {
  const base = getBackendBaseUrl();
  try {
    const response = await fetch(`${base}/api/v1/projects`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Failed to fetch projects: ${response.statusText}`);
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error("Error fetching projects:", error);
    return [];
  }
}

export async function createProject(name: string, config: ProjectConfig = {}): Promise<Project | null> {
  const base = getBackendBaseUrl();
  try {
    const response = await fetch(`${base}/api/v1/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, config }),
    });
    if (!response.ok) {
      console.error("Failed to create project:", response.statusText);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Error creating project:", error);
    return null;
  }
}

export async function getProject(projectId: string): Promise<Project | null> {
  const base = getBackendBaseUrl();
  try {
    const response = await fetch(`${base}/api/v1/projects/${projectId}`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Error fetching project:", error);
    return null;
  }
}

export async function updateProject(projectId: string, name: string, config: ProjectConfig): Promise<Project | null> {
  const base = getBackendBaseUrl();
  try {
    const response = await fetch(`${base}/api/v1/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, config }),
    });
    if (!response.ok) {
      console.error("Failed to update project:", response.statusText);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Error updating project:", error);
    return null;
  }
}

export async function deleteProject(projectId: string): Promise<boolean> {
  const base = getBackendBaseUrl();
  try {
    const response = await fetch(`${base}/api/v1/projects/${projectId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      console.error("Failed to delete project:", response.statusText);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error deleting project:", error);
    return false;
  }
}

// --- Session API ---

export async function listSessions(projectId: string): Promise<Session[]> {
  const base = getBackendBaseUrl();

  try {
    const response = await fetch(`${base}/api/v1/projects/${projectId}/sessions`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.statusText}`);
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error(`Error fetching sessions for project ${projectId}:`, error);
    return [];
  }
}

export async function listAllSessions(): Promise<Session[]> {
  const projects = await listProjects();
  if (!projects || projects.length === 0) return [];

  const sessionPromises = projects.map(async (p) => {
    const sessions = await listSessions(p.id);
    return sessions.map(s => ({ ...s, projectName: p.name }));
  });
  const results = await Promise.all(sessionPromises);

  // Flatten arrays
  const allSessions = results.flat();

  // Sort by created_at desc (newest first)
  return allSessions.sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });
}

export async function getSession(projectId: string, sessionId: string): Promise<Session | null> {
  const base = getBackendBaseUrl();

  try {
    const response = await fetch(`${base}/api/v1/projects/${projectId}/sessions/${sessionId}`, {
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

export async function getSessionEvents(projectId: string, sessionId: string): Promise<Event[]> {
  const base = getBackendBaseUrl();

  try {
    const response = await fetch(`${base}/api/v1/projects/${projectId}/sessions/${sessionId}/events`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.statusText}`);
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error("Error fetching events:", error);
    return [];
  }
}

export async function createSession(projectId: string, name: string): Promise<Session | null> {
  const base = getBackendBaseUrl();

  try {
    const response = await fetch(`${base}/api/v1/projects/${projectId}/sessions`, {
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

export async function deleteSession(projectId: string, sessionId: string): Promise<boolean> {
  const base = getBackendBaseUrl();
  try {
    const response = await fetch(`${base}/api/v1/projects/${projectId}/sessions/${sessionId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      console.error("Failed to delete session:", response.statusText);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error deleting session:", error);
    return false;
  }
}

// --- Capture Status ---

export async function getGlobalRecordingStatus(): Promise<RecordingStatus | null> {
  const base = getBackendBaseUrl();
  try {
    const response = await fetch(`${base}/api/v1/record/status`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Error fetching recording status:", error);
    return null;
  }
}

export async function startRecording(projectId: string, sessionId: string): Promise<boolean> {
  const base = getBackendBaseUrl();
  try {
    const response = await fetch(`${base}/api/v1/projects/${projectId}/sessions/${sessionId}/record/start`, {
      method: "POST",
    });
    if (!response.ok) {
      console.error("Failed to start recording:", response.statusText);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error starting recording:", error);
    return false;
  }
}

export async function stopRecording(projectId: string, sessionId: string): Promise<boolean> {
  const base = getBackendBaseUrl();
  try {
    const response = await fetch(`${base}/api/v1/projects/${projectId}/sessions/${sessionId}/record/stop`, {
      method: "POST",
    });
    if (!response.ok) {
      console.error("Failed to stop recording:", response.statusText);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error stopping recording:", error);
    return false;
  }
}
