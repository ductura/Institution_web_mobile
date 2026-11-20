"use client";

import { useEffect, useRef, useState } from "react";
import { Editor } from "@tiptap/core";
import { Button, Dialog, SaveState } from "../../node_modules/.ductura-mobile/ui.mjs";
import { rad } from "../lib/messages.hr.js";
import { createWorkSync, editorContent, openStudentWork, submitStudentWork } from "../lib/work-evidence.js";
import Stanje from "./Stanje.jsx";

export default function StudentWork({ assignmentId }) {
  const [attempt, retry] = useState(0);
  const [opened, setOpened] = useState(undefined);

  useEffect(() => {
    let current = true;
    openStudentWork(assignmentId).then(
      (result) => { if (current) setOpened(result); },
      () => { if (current) setOpened(null); },
    );
    return () => { current = false; };
  }, [assignmentId, attempt]);

  if (opened === undefined) return <p role="status">{rad.otvaranje}</p>;
  if (opened === "odjavljen") return <Stanje stanje="odjavljen" putanja={`/rad/${assignmentId}`} />;
  if (!opened) return (
    <>
      <p role="alert">{rad.nedostupan}</p>
      <Button onClick={() => { setOpened(undefined); retry(attempt + 1); }}>{rad.ponovno}</Button>
    </>
  );
  return <WorkEditor key={opened.work.documentId} opened={opened} assignmentId={assignmentId} />;
}

function WorkEditor({ opened, assignmentId }) {
  const surface = useRef(null);
  const session = useRef(null);
  const submitting = useRef(false);
  /** @type {[import("@ductura/ui").SaveStateName | null, (state: import("@ductura/ui").SaveStateName) => void]} */
  const [saveState, setSaveState] = useState(null);
  const [locked, setLocked] = useState(false);
  const [submitted, setSubmitted] = useState(opened.submitted);
  const [receipt, setReceipt] = useState(null);
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const sync = createWorkSync(opened, (state) => {
      setSaveState(state);
      if (state === "RECOVERY_REQUIRED" || state === "CONFLICT") session.current?.editor.setEditable(false);
    });
    const document = editorContent(opened.work.document, rad.pocni);
    const editor = new Editor({
      element: surface.current,
      content: document.content,
      extensions: [...document.extensions, ...sync.extensions],
      editable: !opened.submitted,
      editorProps: { attributes: { role: "textbox", "aria-label": rad.sadrzaj, "aria-multiline": "true" } },
      onTransaction: ({ transaction, appendedTransactions }) => sync.record(transaction, appendedTransactions),
    });
    session.current = { editor, sync };
    const reconnect = () => { void sync.flush(); };
    const leaving = (event) => {
      if (sync.hasChanges() || submitting.current) {
        event.preventDefault();
        event.returnValue = true;
      }
    };
    window.addEventListener("online", reconnect);
    window.addEventListener("beforeunload", leaving);
    return () => {
      session.current = null;
      sync.dispose();
      editor.destroy();
      window.removeEventListener("online", reconnect);
      window.removeEventListener("beforeunload", leaving);
    };
  }, [opened]);

  async function confirm() {
    if (submitting.current || !session.current) return;
    const { editor, sync } = session.current;
    submitting.current = true;
    setBusy(true);
    setError("");
    editor.setEditable(false);
    let keepLocked = locked;
    try {
      if (!await sync.flush()) {
        setError(rad.greskaSpremanja);
        return;
      }
      // A lost response can follow a successful submission. Retry this revision until confirmed.
      keepLocked = true;
      const result = await submitStudentWork(sync.submission(), assignmentId, sync.currentHead(), opened);
      if (!result.receipt) {
        keepLocked = !result.rejected;
        setError(result.rejected ? rad.predajaOdbijena : rad.greskaPredaje);
        return;
      }
      setReceipt(result.receipt);
      setSubmitted(true);
      setDialog(false);
    } catch {
      setError(rad.greskaPredaje);
    } finally {
      setLocked(keepLocked);
      if (!keepLocked && !sync.isStopped()) editor.setEditable(true);
      submitting.current = false;
      setBusy(false);
    }
  }

  const stopped = saveState === "CONFLICT" || saveState === "RECOVERY_REQUIRED";
  return (
    <>
      <div className="work-paper" ref={surface} />
      {submitted ? (
        <div className="work-result" role="status">
          <strong>{rad.predano}</strong>
          {receipt && <dl><dt>{rad.revizija}</dt><dd>{receipt.revision}</dd>
            <dt>{rad.otisak}</dt><dd>{receipt.artifactSha256}</dd></dl>}
        </div>
      ) : (
        <footer className="editor-bar work-bar">
          <div>
            {saveState && <SaveState state={saveState} />}
            {saveState === "CONFLICT" && <p>{rad.izmijenjen}</p>}
            {saveState === "ERROR" && <p>{rad.greskaSpremanja}</p>}
            {saveState === "RECOVERY_REQUIRED" && <p>{rad.oporavak}</p>}
          </div>
          <div className="work-actions">
            <Button tone="quiet" onClick={() => { void session.current?.sync.flush(); }}
              disabled={stopped || locked}>{rad.spremi}</Button>
            <Button onClick={() => { setError(""); setDialog(true); }}
              disabled={stopped || (saveState === null && opened.work.revision === 0)}>
              {locked ? rad.provjeriPredaju : rad.predaj}
            </Button>
          </div>
        </footer>
      )}
      <Dialog open={dialog} title={rad.pitanje} error={error} dismissible={!busy}
        onClose={() => setDialog(false)} actions={
          <>
            <Button tone="quiet" disabled={busy} onClick={() => setDialog(false)}>{rad.odustani}</Button>
            <Button busy={busy} onClick={confirm}>{busy ? rad.predajem : rad.potvrdi}</Button>
          </>
        }>
        <p>{rad.opisPredaje}</p>
      </Dialog>
    </>
  );
}
