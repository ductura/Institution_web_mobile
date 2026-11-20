"use client";

import { useEffect } from "react";
import { isKeyboardOpen } from "../lib/doc.js";

// Zaslonska tipkovnica: traka za spremanje ostaje iznad tipkovnice.
// Najveća viđena visina (bez tipkovnice) za trenutnu širinu. Tipkovnica mijenja samo visinu,
// a okretanje uređaja mijenja širinu, pa se tada mjerenje počinje ispočetka.
export default function Tipkovnica() {
  useEffect(() => {
    let fullHeight = 0;
    let measuredWidth = 0;
    const vv = window.visualViewport;
    function onViewport() {
      if (window.innerWidth !== measuredWidth) {
        measuredWidth = window.innerWidth;
        fullHeight = 0;
      }
      // WebKit ne javlja uvijek visualViewport 'resize', pa se gleda i window.innerHeight.
      const visible = Math.min(vv?.height ?? Infinity, window.innerHeight);
      fullHeight = Math.max(fullHeight, visible);
      document.body.classList.toggle("keyboard-open", isKeyboardOpen(visible, fullHeight));
      const offset = vv ? Math.max(window.innerHeight - vv.height - vv.offsetTop, 0) : 0;
      document.documentElement.style.setProperty("--vv-bottom", `${offset}px`);
    }
    vv?.addEventListener("resize", onViewport);
    vv?.addEventListener("scroll", onViewport);
    window.addEventListener("resize", onViewport);
    onViewport();
    return () => {
      vv?.removeEventListener("resize", onViewport);
      vv?.removeEventListener("scroll", onViewport);
      window.removeEventListener("resize", onViewport);
    };
  }, []);
  return null;
}
