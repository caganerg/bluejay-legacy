import type { Metadata } from "next";
import "./globals.css";
import { AUTH_ENABLED } from "@/lib/auth";
import { AuthProvider } from "@/lib/auth-context";

// `proxy.ts` generates a fresh nonce on every request and puts it in the CSP
// header. For Next to write that nonce onto the script tags it injects itself,
// the page has to be rendered at request time: the HTML of a statically
// pre-rendered page is produced at build time without a nonce, and since
// `'strict-dynamic'` makes `'self'` be ignored, every script was blocked in
// production.
// (see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md)
// The pages fetch their data on the client anyway, so nothing is lost by
// skipping the pre-render.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bluejay Notes | Cloud PKM",
  description:
    "A cloud-based, modern Markdown note-taking system with bi-directional links (wikilinks) and a Graph View.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0d16] text-slate-100 min-h-screen font-sans antialiased overflow-hidden">
        <AuthProvider enabled={AUTH_ENABLED}>{children}</AuthProvider>
      </body>
    </html>
  );
}
