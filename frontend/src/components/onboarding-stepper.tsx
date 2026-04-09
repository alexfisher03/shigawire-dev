"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Route,
  FolderKanban,
  Radio,
  Play,
  ChevronRight,
  ChevronLeft,
  X,
} from "lucide-react";

interface Step {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: <Route className="w-6 h-6 text-blue-300" />,
    title: "Welcome to Shigawire",
    body: "Shigawire is an HTTP recording and replay proxy. It sits between your client and upstream service, capturing every request and response so you can inspect, debug, and replay traffic.",
  },
  {
    icon: <FolderKanban className="w-6 h-6 text-blue-300" />,
    title: "Create a Project",
    body: "Start by creating a project. A project defines the upstream target (host, port, scheme) that Shigawire will forward traffic to. Each project can hold multiple recording sessions.",
  },
  {
    icon: <Radio className="w-6 h-6 text-emerald-400" />,
    title: "Record a Session",
    body: "Open a project, create a session, and hit Record. Point your HTTP client at the proxy port and every request flows through Shigawire, captured with full headers and bodies. Sensitive information is automatically redacted before storage.",
  },
  {
    icon: <Play className="w-6 h-6 text-amber-400" />,
    title: "Replay & Inspect",
    body: "Open any session to browse its timeline. Use the track or list view to scrub through requests, inspect payloads, and replay traffic against your upstream to compare responses.",
  },
];

interface OnboardingStepperProps {
  onComplete: () => void;
}

export function OnboardingStepper({ onComplete }: OnboardingStepperProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(onComplete, 300);
  }, [onComplete]);

  const next = () => {
    if (step === STEPS.length - 1) {
      close();
      return;
    }
    setDirection("next");
    setStep((s) => s + 1);
  };

  const prev = () => {
    setDirection("prev");
    setStep((s) => Math.max(0, s - 1));
  };

  const current = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center transition-all duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={close}
      />

      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl border border-zinc-700/60 bg-zinc-950/95 shadow-2xl shadow-blue-950/30 overflow-hidden transition-all duration-300"
        style={{
          transform: visible ? "scale(1) translateY(0)" : "scale(0.95) translateY(12px)",
        }}
      >
        <div className="flex items-center justify-between px-8 pt-6 pb-0">
          <div />
          <button
            type="button"
            onClick={close}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors cursor-pointer"
            aria-label="Skip onboarding"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-8 pt-3 pb-2">
          <div className="flex gap-1.5 mb-8">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-colors duration-300"
                style={{
                  backgroundColor:
                    i <= step ? "rgb(59 130 246 / 0.7)" : "rgb(63 63 70 / 0.5)",
                }}
              />
            ))}
          </div>

          <div
            key={step}
            className="animate-in fade-in"
            style={{
              animation: `${direction === "next" ? "slideInRight" : "slideInLeft"} 0.25s ease-out`,
            }}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-xl border border-zinc-700/50 bg-zinc-900/70 mb-5">
              {current.icon}
            </div>

            <h2 className="text-xl font-semibold text-zinc-100 tracking-tight mb-3">
              {current.title}
            </h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              {current.body}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between px-8 py-6 mt-4">
          <div className="text-xs font-mono text-zinc-600">
            {step + 1} / {STEPS.length}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={prev}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-700/60 bg-zinc-900/50 text-zinc-300 text-xs font-mono hover:bg-zinc-800/60 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg border border-blue-600/50 bg-blue-600/15 text-blue-200 text-xs font-mono hover:bg-blue-600/25 transition-colors cursor-pointer"
            >
              {step === STEPS.length - 1 ? "Get started" : "Next"}
              {step < STEPS.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        <style jsx>{`
          @keyframes slideInRight {
            from {
              opacity: 0;
              transform: translateX(24px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes slideInLeft {
            from {
              opacity: 0;
              transform: translateX(-24px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
