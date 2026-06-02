import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FileVista - 纯浏览器端文件预览工具集",
  description: "支持本地 File、Blob、ArrayBuffer 和远程 URL，面向 React、Vue、Svelte 等主流前端框架提供统一预览能力。所有处理均在浏览器内完成 — 文件不会离开你的设备。",
  keywords: ["文件预览", "PDF 查看器", "代码查看器", "Markdown", "浏览器预览", "客户端预览", "FileVista"],
  authors: [{ name: "FileVista Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "FileVista",
    description: "纯浏览器端文件预览工具集",
    url: "https://filevista.dev",
    siteName: "FileVista",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FileVista",
    description: "纯浏览器端文件预览工具集",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
