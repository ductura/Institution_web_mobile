"use client";

import { useRef, useState } from "react";
import { debounce, saveStatusLabel, wordCount } from "../lib/doc.js";
import { api } from "../lib/putanje.js";

async function spremi(doc) {
  const r = await fetch(api(`/documents/${encodeURIComponent(doc.id)}`), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(doc),
  });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export default function Editor({ doc }) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [state, setState] = useState("idle");
  const zadnje = useRef({ title: doc.title, content: doc.content });

  const odgoda = useRef(null);
  async function posalji() {
    setState("saving");
    try {
      await spremi({ id: doc.id, ...zadnje.current });
      setState("saved");
    } catch {
      setState("error");
    }
  }
  // Created on first use, in an event handler; the page gives each document its own Editor.
  const spremanje = () => (odgoda.current ??= debounce(posalji, 600));

  function promjena(e) {
    const polje = e.target.id === "title" ? "title" : "content";
    zadnje.current = { ...zadnje.current, [polje]: e.target.value };
    (polje === "title" ? setTitle : setContent)(e.target.value);
    setState("dirty");
    spremanje()();
  }

  return (
    <>
      <input id="title" aria-label="Naslov" value={title} onChange={promjena} />
      <textarea id="editor" aria-label="Sadržaj" value={content} onChange={promjena} />
      <footer className="editor-bar">
        <span id="words">{`${wordCount(content)} riječi`}</span>
        <span id="status" role="status" data-state={state}>
          {saveStatusLabel(state)}
        </span>
        <button id="save" type="button" onClick={() => spremanje().flush()}>
          Spremi
        </button>
      </footer>
    </>
  );
}
