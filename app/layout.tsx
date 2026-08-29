import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyMate AI",
  description: "A grounded AI assistant for lecture PDFs, cited answers, and interactive quizzes.",
  authors: [{ name: "Yusuf Alaghbari" }],
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
