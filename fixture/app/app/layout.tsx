import { LoupeMount } from "@danarocha/loupe/mount";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loupe fixture",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {/* As `loupe init` writes it: the Toolbar, in development only. */}
        {process.env.NODE_ENV === "development" && <LoupeMount />}
      </body>
    </html>
  );
}
