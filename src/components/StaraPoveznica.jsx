"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { docHref, parseRoute } from "../lib/doc.js";

// Links from before Next.js ("/#/doc/abc") open the document page "/doc/abc",
// also when one is opened while the list is already shown (same-document hash change).
export default function StaraPoveznica() {
  const router = useRouter();
  useEffect(() => {
    const otvori = () => {
      const r = parseRoute(window.location.hash);
      if (r.view === "doc") router.replace(docHref(r.id));
    };
    otvori();
    window.addEventListener("hashchange", otvori);
    return () => window.removeEventListener("hashchange", otvori);
  }, [router]);
  return null;
}
