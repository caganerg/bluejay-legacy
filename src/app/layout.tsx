import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bluejay Notes | Cloud PKM",
  description: "Bulut tabanlı, çift yönlü bağlantı (wikilinks) ve Graph View destekli modern Markdown not alma sistemi.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body className="bg-[#0a0d16] text-slate-100 min-h-screen font-sans antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
