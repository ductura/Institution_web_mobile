import Link from "next/link";
import "@ductura/ui/tokens.css";
import Tipkovnica from "../src/components/Tipkovnica.jsx";
import { poruke } from "../src/lib/prijava-problema.hr.js";
import styles from "./prijavi-problem/prijava-problema.module.css";
import "./globals.css";

export const metadata = {
  title: "Ductura",
  description: "Ductura mobilni frontend za mobitele i tablete",
};

// interactive-widget=resizes-content: the on-screen keyboard shrinks the layout,
// so the save bar stays above it.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }) {
  return (
    <html lang="hr">
      <body>
        <header className="bar">
          <Link href="/" id="nav-home">
            Ductura
          </Link>
          <span id="variant">Mobilno</span>
        </header>
        <main id="view">{children}</main>
        <footer className={styles.podnozje}>
          <Link href="/prijavi-problem" tabIndex={0}>{poruke.naslov}</Link>
        </footer>
        <Tipkovnica />
      </body>
    </html>
  );
}
