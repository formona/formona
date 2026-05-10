import type { Metadata, Viewport } from "next";
import "../index.css";

export const metadata: Metadata = {
  title: "MONABROW",
  description: "AI-powered eyebrow analysis and AR styling experience for personalized beauty design.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <div className="brand-accent" />
        {children}
      </body>
    </html>
  );
}
