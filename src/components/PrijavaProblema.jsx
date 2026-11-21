"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../../node_modules/.ductura-mobile/ui.mjs";
import { Select, TextArea } from "../../node_modules/.ductura-mobile/prijava-problema.mjs";
import { api, BASE_PATH, prijava } from "../lib/putanje.js";
import { poruke } from "../lib/prijava-problema.hr.js";
import styles from "../../app/prijavi-problem/prijava-problema.module.css";

const KATEGORIJE = [
  { value: "technical", label: poruke.tehnicki },
  { value: "account", label: poruke.racun },
  { value: "course", label: poruke.kolegij },
];
const NACRT = `ductura:${BASE_PATH}/prijavi-problem`;
const MAX_OPIS = 1000;

export default function PrijavaProblema({ verzija }) {
  const obrazac = useRef(/** @type {HTMLFormElement | null} */ (null));
  const [ceka, postaviCeka] = useState(false);
  const [greska, postaviGresku] = useState("");
  const [potvrda, postaviPotvrdu] = useState("");

  useEffect(() => {
    try {
      const nacrt = JSON.parse(sessionStorage.getItem(NACRT) ?? "null");
      const kategorija = obrazac.current?.querySelector("select");
      const opis = obrazac.current?.querySelector("textarea");
      if (kategorija && KATEGORIJE.some(({ value }) => value === nacrt?.category)) {
        kategorija.value = nacrt.category;
      }
      if (opis && typeof nacrt?.description === "string") opis.value = nacrt.description;
    } catch {
      // The form is still usable when storage is unavailable.
    }
  }, []);

  /** @param {import("react").FormEvent<HTMLFormElement>} event */
  async function posalji(event) {
    event.preventDefault();
    if (ceka) return;

    const podatci = new FormData(event.currentTarget);
    const category = String(podatci.get("category") ?? "");
    const description = String(podatci.get("description") ?? "");
    if (!description.trim() || [...description].length > MAX_OPIS) {
      postaviGresku(poruke.neispravanOpis);
      event.currentTarget.querySelector("textarea")?.focus();
      return;
    }

    postaviCeka(true);
    postaviGresku("");
    try {
      const res = await fetch(api("/prijavi-problem"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category, description, appVersion: verzija,
          browser: { family: "other", major: null }, route: null, syncState: null,
        }),
      });
      if (res.status === 401) {
        try {
          sessionStorage.setItem(NACRT, JSON.stringify({ category, description }));
        } catch {
          postaviGresku(poruke.nemaPohrane);
          return;
        }
        window.location.assign(prijava(`${BASE_PATH}/prijavi-problem`));
      } else if (res.status === 201) {
        const { reference } = await res.json();
        postaviPotvrdu(poruke.potvrda(reference));
        try {
          sessionStorage.removeItem(NACRT);
        } catch {
          // The report has already been recorded.
        }
      } else {
        const poruka = res.status === 422 ? poruke.neispravanOpis
          : res.status === 429 ? poruke.previsePrijava : poruke.greska;
        postaviGresku(poruka);
      }
    } catch {
      postaviGresku(poruke.greska);
    } finally {
      postaviCeka(false);
    }
  }

  return (
    <>
      {!potvrda && (
        <form ref={obrazac} className={styles.obrazac} method="post" onSubmit={posalji}>
          <Select name="category" label={poruke.kategorija}
            options={KATEGORIJE} defaultValue="technical" busy={ceka} />
          <TextArea name="description" label={poruke.opis}
            hint={poruke.uputa} required busy={ceka} />
          <Button type="submit" busy={ceka}>{ceka ? poruke.saljem : poruke.posalji}</Button>
          {greska && <p role="alert">{greska}</p>}
        </form>
      )}
      <div role="status">{potvrda}</div>
    </>
  );
}
