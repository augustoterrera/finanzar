import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Search } from "lucide-react";
import { MainDock } from "@/components/MainDock";
import { DesktopNav } from "@/components/DesktopNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Finanzar",
  description: "App de finanzas personales anti-fricción",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} min-h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex flex-col`}>
        <div className="hidden md:flex fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full justify-center">
          <DesktopNav />
        </div>

        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 pb-24 md:pt-28 md:pb-6">
          {children}
        </main>
        
        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <MainDock />
        </div>
      </body>
    </html>
  );
}
