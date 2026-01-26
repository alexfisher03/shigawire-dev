import { getBackendBaseUrl } from "@/lib/backend";
import Link from "next/link";

interface Session {
  id: string;
  name: string;
  created_at?: string;
  sealed?: boolean;
}

async function getSessions(): Promise<Session[]> {
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

export default async function SessionsPage() {
  const sessions = await getSessions();

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Sessions</h1>
          <p className="text-muted-foreground">
            View and manage your recorded HTTP sessions
          </p>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">
              No sessions found. Create a new session to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="block p-6 rounded border border-border bg-card hover:bg-secondary/20 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-foreground mb-1">
                      {session.name}
                    </h2>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      {session.created_at && (
                        <span>
                          Created:{" "}
                          {new Date(session.created_at).toLocaleDateString()}
                        </span>
                      )}
                      <span>{session.sealed ? "Completed" : "Recording"}</span>
                    </div>
                  </div>
                  <div className="text-primary">→</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
