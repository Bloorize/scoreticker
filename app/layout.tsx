import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
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
  title: "BYU Football Tracker | Road to the CFP",
  description: "Track BYU football's journey to the College Football Playoff. Real-time scores, game predictions, rooting guide, and playoff odds.",
  keywords: ["BYU", "BYU Football", "College Football", "CFP", "College Football Playoff", "BYU Cougars", "Football Tracker"],
  authors: [{ name: "BYU Football Tracker" }],
  other: {
    "google-adsense-account": "ca-pub-2568418773305987",
  },
  openGraph: {
    title: "BYU Football Tracker | Road to the CFP",
    description: "Track BYU football's journey to the College Football Playoff. Real-time scores, game predictions, rooting guide, and playoff odds.",
    type: "website",
    url: "https://www.byufootballtracker.com",
    siteName: "BYU Football Tracker",
    images: [
      {
        url: "https://www.byufootballtracker.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "BYU Football Tracker - Road to the CFP",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BYU Football Tracker | Road to the CFP",
    description: "Track BYU football's journey to the College Football Playoff. Real-time scores, game predictions, rooting guide, and playoff odds.",
    images: ["https://www.byufootballtracker.com/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-85RYBJ651R"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-85RYBJ651R');
          `}
        </Script>
        
        {children}
      </body>
    </html>
  );
}
