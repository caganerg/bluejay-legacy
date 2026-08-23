import type { Metadata } from "next";
import "./globals.css";

// `proxy.ts` her istekte taze bir nonce üretip CSP başlığına koyuyor. Next'in bu
// nonce'u kendi enjekte ettiği script etiketlerine yazabilmesi için sayfanın
// istek anında render edilmesi gerekiyor: statik ön-render edilen bir sayfanın
// HTML'i derleme zamanında, nonce'suz üretiliyor ve `'strict-dynamic'` yüzünden
// `'self'` yok sayıldığından üretimde bütün script'ler bloke oluyordu.
// (bkz. node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md)
// Sayfalar zaten veriyi istemcide çektiği için ön-render'dan kaybedilen bir şey yok.
export const dynamic = "force-dynamic";

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
