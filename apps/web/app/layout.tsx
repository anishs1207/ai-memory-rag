import "@repo/ui/styles.css";
import "./globals.css";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import StoreProvider from "@/lib/redux/provider";
import OnboardingWidget from "@/components/onboarding/OnboardingWidget";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agentic RAG",
  description: "Modern Agentic RAG interface",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={geist.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <StoreProvider>
            {children}
          </StoreProvider>
          <OnboardingWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
