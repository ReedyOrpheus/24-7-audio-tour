//This file is responsible for the layout of the main page.

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "24-7 Audio Tour",
  description: "Instant GPS-based audio tours of nearby landmarks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
