import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"], // latin-ext covers Vietnamese diacritics
  display: "swap",
});

export const metadata: Metadata = {
  title: "EngLearn — Học tiếng Anh",
  description: "Học flashcard và luyện đọc hiểu tiếng Anh.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
