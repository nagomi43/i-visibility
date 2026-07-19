import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Visibility Score | SEO × AEO × GEO 解析",
  description:
    "URLを入力すると、WebページをSEO/AEO/GEOの観点から解析し、AIに引用・推薦されやすさを100点満点で推定するMVPです。",
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-void-950 text-slate-100`}
      >
        {children}
      </body>
    </html>
  );
}
