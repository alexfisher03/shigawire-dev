"use client";

import { AppErrorProvider } from "@/components/app-error-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AppErrorProvider>{children}</AppErrorProvider>;
}
