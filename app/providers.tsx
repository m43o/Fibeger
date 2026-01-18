"use client";

import { SessionProvider } from "next-auth/react";
import BrowserNotifications from "./components/BrowserNotifications";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BrowserNotifications />
      {children}
    </SessionProvider>
  );
}
