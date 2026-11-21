import PrijavaProblema from "../../src/components/PrijavaProblema.jsx";
import { poruke } from "../../src/lib/prijava-problema.hr.js";
import paket from "../../package.json";
import styles from "./prijava-problema.module.css";

export default function StranicaPrijaveProblema() {
  return (
    <section className={`sheet ${styles.stranica}`} data-sheet-theme="light">
      <h1>{poruke.naslov}</h1>
      <PrijavaProblema verzija={paket.version} />
    </section>
  );
}
