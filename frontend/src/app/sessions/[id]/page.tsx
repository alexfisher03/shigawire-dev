import Link from "next/link";
import { Event, getSession, getSessionEvents, Session } from "@/lib/api";

function getStatusColor(status?: number): string {
  if (!status) return "text-muted-foreground";
  if (status >= 200 && status < 300) return "text-green-400";
  if (status >= 300 && status < 400) return "text-blue-400";
  if (status >= 400 && status < 500) return "text-yellow-400";
  return "text-red-400";
}

function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "bg-blue-500/20 text-blue-400";
    case "POST":
      return "bg-green-500/20 text-green-400";
    case "PUT":
      return "bg-yellow-500/20 text-yellow-400";
    case "DELETE":
      return "bg-red-500/20 text-red-400";
    case "PATCH":
      return "bg-purple-500/20 text-purple-400";
    default:
      return "bg-gray-500/20 text-gray-400";
  }
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/sessions"
            className="text-primary hover:underline mb-8 inline-block"
          >
            ← Back to Sessions
          </Link>
          <div className="rounded border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">Missing session id</p>
          </div>
        </div>
      </div>
    );
  }

  const [session, events] = await Promise.all([
    getSession(id),
    getSessionEvents(id),
  ]);

  if (!session) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/sessions"
            className="text-primary hover:underline mb-8 inline-block"
          >
            ← Back to Sessions
          </Link>
          <div className="rounded border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">Session not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/sessions"
          className="text-primary hover:underline mb-6 inline-block"
        >
          ← Back to Sessions
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {session.name}
          </h1>
          {session.created_at && (
            <p className="text-sm text-muted-foreground">
              Created: {new Date(session.created_at).toLocaleString()}
            </p>
          )}
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Events ({events.length})
          </h2>

          {events.length === 0 ? (
            <div className="rounded border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">
                No events recorded for this session
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="p-4 rounded border border-border bg-card hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 flex-1">
                      <span
                        className={`px-3 py-1 rounded text-xs font-semibold ${getMethodColor(event.method)}`}
                      >
                        {event.method.toUpperCase()}
                      </span>
                      <span className="text-foreground font-mono flex-1 break-all">
                        {event.path}
                      </span>
                      {event.status && (
                        <span
                          className={`text-sm font-semibold ${getStatusColor(event.status)}`}
                        >
                          {event.status}
                        </span>
                      )}
                    </div>
                    {event.duration && (
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {event.duration}ms
                      </span>
                    )}
                  </div>
                  {event.timestamp && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
