import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "../components/ThemeProvider";
import NavMenu from "./components/NavMenu";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Supernova",
  description: "Supernova – A modern, star-themed link shortener app.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <NavMenu />
            <main className="transition-all duration-300 md:pl-20">
              <div className="w-full flex justify-center items-center py-8">
                <img src="/supernova-logo.svg" alt="Supernova Logo" className="h-12 w-12 mr-3" />
                <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Supernova</span>
              </div>
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
