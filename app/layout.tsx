import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3PL Asset Tracker",
  description: "B2B asset tracking for 3PL companies",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
