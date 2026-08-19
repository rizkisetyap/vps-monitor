import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VPS Monitor",
  description: "Monitor and control PM2 apps and nginx on your VPS"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
