import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teach-the-AI Student",
  description:
    "A voice-first MVP where people learn by teaching an AI student out loud.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
