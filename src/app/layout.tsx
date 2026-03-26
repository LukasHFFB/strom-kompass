import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Strom-Kompass — Deutschlands Energiemarkt auf einen Blick",
    template: "%s | Strom-Kompass",
  },
  description:
    "Aktuelle Strompreise, Erzeugungsmix, installierte Leistung und mehr — alle Daten aus ENTSO-E, Netztransparenz und BNetzA konsolidiert.",
  keywords: [
    "Strompreis heute",
    "Strompreis Verlauf",
    "Energiemix Deutschland",
    "Day-Ahead Preise",
    "erneuerbare Energien Deutschland",
    "installierte Leistung",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>
        <header>
          <div className="container">
            <h1>⚡ Strom-Kompass</h1>
            <nav>
              <a href="/">Übersicht</a>
              <a href="/strompreis">Strompreis</a>
              <a href="/erzeugung">Energiemix</a>
              <a href="/analyse">Analyse-Tool</a>
            </nav>
          </div>
        </header>
        <main className="container">
          {children}
        </main>
        <footer>
          <div className="container">
            Daten: ENTSO-E Transparency Platform · Netztransparenz.de · BNetzA
          </div>
        </footer>
      </body>
    </html>
  );
}
