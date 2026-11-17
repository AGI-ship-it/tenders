import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AGFS Tender Intelligence (Demo)",
  description:
    "Clickable prototype: tender alerts and portal scans become D365 leads, AI prequalifies, VP Commercial approves for bidding. All data simulated.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      // next-themes sets the theme class before hydration.
      suppressHydrationWarning
    >
      <body className="min-h-full" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="agfs-theme" disableTransitionOnChange>
          <TooltipProvider delay={200}>
            <Suspense>
              <AppShell>{children}</AppShell>
            </Suspense>
          </TooltipProvider>
          <Toaster position="top-right" offset={{ top: 64 }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
