"use client";

import * as React from "react";

/**
 * Parola korumasının açık olup olmadığını istemciye taşır.
 *
 * `BLUEJAY_PASSWORD` sunucu tarafında kalan bir sır; istemcinin bilmesi gereken
 * tek şey korumanın etkin olup olmadığı. Kök layout (sunucu bileşeni) bu boolean'ı
 * okuyup buraya veriyor, arayüz de kilitleme gibi yalnızca koruma açıkken anlamlı
 * olan kontrolleri buna göre gösteriyor.
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
