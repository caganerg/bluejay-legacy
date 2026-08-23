"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || pending) return;

    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Giriş yapılamadı.");
        setPassword("");
        return;
      }

      // Açık yönlendirmeyi önlemek için yalnızca site içi yollara dön.
      const next = searchParams.get("next");
      const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.replace(target);
      router.refresh();
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen flex items-center justify-center bg-[#0a0d16] px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/25">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-white">Bluejay Notes</h1>
            <p className="text-xs text-slate-400">Kasayı açmak için parolanı gir.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Parola"
              autoFocus
              autoComplete="current-password"
              aria-label="Parola"
              aria-invalid={Boolean(error)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/70 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500/60 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-rose-400">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={pending || !password}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm gap-2 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {pending ? "Kontrol ediliyor..." : "Kasayı Aç"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // `useSearchParams` bir Suspense sınırı gerektiriyor.
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#0a0d16]" />}>
      <LoginForm />
    </React.Suspense>
  );
}
