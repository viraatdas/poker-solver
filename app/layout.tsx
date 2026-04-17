import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solver — NLHE GTO",
  description: "A free, open-source No-Limit Hold'em GTO solver.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased font-sans">{children}</body>
    </html>
  );
}
