"use client";

import * as React from "react";

/**
 * Carries to the client whether password protection is enabled.
 *
 * `BLUEJAY_PASSWORD` is a secret that stays on the server; all the client needs
 * to know is whether protection is active. The root layout (a server component)
 * reads that boolean and passes it in here, and the UI uses it to decide whether
 * to show controls — such as locking — that only make sense while protection is
 * on.
 */
const AuthEnabledContext = React.createContext(false);

export function AuthProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return <AuthEnabledContext.Provider value={enabled}>{children}</AuthEnabledContext.Provider>;
}

export function useAuthEnabled(): boolean {
  return React.useContext(AuthEnabledContext);
}
