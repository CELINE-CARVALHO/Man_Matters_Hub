import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/components/ui";

const inter = Inter({ subsets: ["latin"] });
export const metadata: Metadata = { title: "Customer Intelligence Hub", description: "Customer research workspace" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
