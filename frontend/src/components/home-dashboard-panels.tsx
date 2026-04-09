"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Event } from "@/lib/api";
import type { EventNotification } from "@/hooks/use-event-stream";

function usePathDraw(
  pathRef: React.RefObject<SVGPathElement | null>,
  active: boolean,
  durationMs = 1150,
) {
  useEffect(() => {
    const path = pathRef.current;
    if (!path || !active) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    const id = requestAnimationFrame(() => {
      path.style.transition = `stroke-dashoffset ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      path.style.strokeDashoffset = "0";
    });
    return () => cancelAnimationFrame(id);
  }, [pathRef, active, durationMs]);
}

const BIN_COUNT = 24;

function buildBins(events: Event[], spanMs: number): number[] {
  const bins = new Array(BIN_COUNT).fill(0);
  if (spanMs <= 0 || events.length === 0) return bins;
  for (const ev of events) {
    const t = ev.started_at ? new Date(ev.started_at).getTime() : 0;
    const firstT = events[0]?.started_at
      ? new Date(events[0].started_at).getTime()
      : 0;
    const rel = t - firstT;
    const idx = Math.min(
      Math.floor((rel / spanMs) * BIN_COUNT),
      BIN_COUNT - 1,
    );
    bins[Math.max(0, idx)] += 1;
  }
  return bins;
}

export function LastSessionVisual({
  active,
  events,
}: {
  active: boolean;
  events: Event[];
}) {
  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(a.started_at ?? 0).getTime() -
          new Date(b.started_at ?? 0).getTime(),
      ),
    [events],
  );

  const spanMs = useMemo(() => {
    if (sorted.length < 2) return 0;
    const first = new Date(sorted[0].started_at ?? 0).getTime();
    const last = new Date(sorted[sorted.length - 1].started_at ?? 0).getTime();
    return Math.max(last - first, 1);
  }, [sorted]);

  const bins = useMemo(() => buildBins(sorted, spanMs), [sorted, spanMs]);
  const maxBin = Math.max(...bins, 1);

  const hasData = sorted.length > 0;

  return (
    <svg viewBox="0 0 120 56" className="w-full h-20" fill="none" aria-hidden>
      <line
        x1="6"
        y1="48"
        x2="114"
        y2="48"
        stroke="rgb(63 63 70 / 0.5)"
        strokeWidth="0.4"
      />
      {hasData
        ? bins.map((count, i) => {
            const x = 8 + i * 4.4;
            const h = (count / maxBin) * 34;
            return (
              <rect
                key={i}
                x={x}
                y={48 - h}
                width="3.2"
                height={Math.max(h, 0)}
                rx="0.4"
                fill="rgb(56 189 248 / 0.45)"
                stroke="rgb(56 189 248 / 0.3)"
                strokeWidth="0.3"
                style={{
                  opacity: active ? 1 : 0,
                  transform: active ? "scaleY(1)" : "scaleY(0)",
                  transformOrigin: `${x + 1.6}px 48px`,
                  transition: `opacity 0.45s ease ${i * 0.025}s, transform 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 0.025}s`,
                }}
              />
            );
          })
        : Array.from({ length: BIN_COUNT }, (_, i) => {
            const x = 8 + i * 4.4;
            return (
              <rect
                key={i}
                x={x}
                y={46.5}
                width="3.2"
                height="1.5"
                rx="0.3"
                fill="rgb(63 63 70 / 0.25)"
                style={{
                  opacity: active ? 0.6 : 0,
                  transition: `opacity 0.5s ease ${i * 0.02}s`,
                }}
              />
            );
          })}
    </svg>
  );
}

function catmullRomSpline(points: [number, number][], tension = 0.35): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)} L ${points[1][0].toFixed(1)} ${points[1][1].toFixed(1)}`;
  }
  const d: string[] = [`M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const cp1x = p1[0] + ((p2[0] - p0[0]) * tension) / 3;
    const cp1y = p1[1] + ((p2[1] - p0[1]) * tension) / 3;
    const cp2x = p2[0] - ((p3[0] - p1[0]) * tension) / 3;
    const cp2y = p2[1] - ((p3[1] - p1[1]) * tension) / 3;
    d.push(
      `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`,
    );
  }
  return d.join(" ");
}

const DENSITY_WINDOW_MS = 30_000;
const DENSITY_BINS = 60;

export function CaptureDensityVisual({
  active,
  recording,
  events,
  nowMs,
}: {
  active: boolean;
  recording: boolean;
  events: EventNotification[];
  nowMs: number;
}) {
  const lineRef = useRef<SVGPathElement>(null);

  const bins = useMemo(() => {
    if (!recording) return new Array(DENSITY_BINS).fill(0);
    const windowEnd = nowMs;
    const windowStart = windowEnd - DENSITY_WINDOW_MS;
    const binWidth = DENSITY_WINDOW_MS / DENSITY_BINS;
    const b = new Array(DENSITY_BINS).fill(0);
    for (const ev of events) {
      if (ev.arrived_at < windowStart || ev.arrived_at > windowEnd) continue;
      const idx = Math.min(
        Math.floor((ev.arrived_at - windowStart) / binWidth),
        DENSITY_BINS - 1,
      );
      b[idx] += 1;
    }
    return b;
  }, [recording, events, nowMs]);

  const maxBin = Math.max(...bins, 1);

  const linePath = useMemo(() => {
    if (!recording) {
      return `M 8 44 L 114 44`;
    }
    const points: [number, number][] = [];
    for (let i = 0; i < DENSITY_BINS; i++) {
      const x = 8 + i * (106 / (DENSITY_BINS - 1));
      const h = (bins[i] / maxBin) * 32;
      points.push([x, 44 - h]);
    }
    return catmullRomSpline(points);
  }, [recording, bins, maxBin]);

  useEffect(() => {
    const path = lineRef.current;
    if (!path || !active) return;
    if (!recording) {
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;
      const id = requestAnimationFrame(() => {
        path.style.transition =
          "stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)";
        path.style.strokeDashoffset = "0";
      });
      return () => cancelAnimationFrame(id);
    }
    path.style.strokeDasharray = "";
    path.style.strokeDashoffset = "0";
    path.style.transition = "";
  }, [lineRef, active, recording]);

  return (
    <svg viewBox="0 0 120 56" className="w-full h-20" fill="none" aria-hidden>
      <line
        x1="6"
        y1="48"
        x2="114"
        y2="48"
        stroke="rgb(63 63 70 / 0.5)"
        strokeWidth="0.4"
      />
      <line
        x1="6"
        y1="10"
        x2="6"
        y2="48"
        stroke="rgb(63 63 70 / 0.35)"
        strokeWidth="0.4"
      />
      <path
        ref={lineRef}
        d={linePath}
        fill="none"
        stroke={recording ? "rgb(74 222 128 / 0.85)" : "rgb(63 63 70 / 0.4)"}
        strokeWidth={recording ? "1.5" : "0.8"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!recording &&
        Array.from({ length: 5 }, (_, i) => {
          const x = 20 + i * 22;
          return (
            <circle
              key={i}
              cx={x}
              cy="44"
              r="1"
              fill="rgb(63 63 70 / 0.35)"
              style={{
                opacity: active ? 0.7 : 0,
                transition: `opacity 0.6s ease ${i * 0.08}s`,
              }}
            />
          );
        })}
    </svg>
  );
}
