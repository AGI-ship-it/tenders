import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AGFS Tender Intelligence (Demo)",
  description:
    "Clickable prototype: AI opportunity scanning, ranking, HoD prequalification and D365 lead hand-off. All data simulated.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full" suppressHydrationWarning>
        <TooltipProvider delay={200}>
          <Suspense>
            <AppShell>{children}</AppShell>
          </Suspense>
        </TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
