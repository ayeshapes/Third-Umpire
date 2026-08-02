import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Third Umpire — PSL Analytics Platform",
  description:
    "Pakistan Super League analytics: player and team stats, venue conditions, head-to-head records, and season-by-season trends.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
