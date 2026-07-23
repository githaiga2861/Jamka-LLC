import React, { useRef, useState } from "react";
import { Empty, Icon } from "../components/ui.jsx";
import { fmtDate } from "../lib/calc.js";
import { deleteDocument, documentUrl, uploadDocument } from "../lib/store.js";

const SECTIONS = [
  { key: "ratecon", label: "Rate confirmations", note: "The rate con paperwork for each trip." },
  { key: "fuel_receipt", label: "Fuel receipts", note: "Pump receipts, diesel and reefer." },
  { key: "broker_receipt", label: "Broker weekly receipts", note: "The Friday receipts from United Transport or other brokers." },
  { key: "own_fuel_receipt", label: "Own-money fuel receipts", note: "Times you fueled with your own money instead of the UT card." },
  { key: "expense_receipt", label: "Expense receipts", note: "Repairs, parts, washes, scales, tolls and the rest." },
  { key: "other", label: "Other documents", note: "Anything else worth keeping safe." },
];

export default function Documents({ docs, refresh }) {
  return (
    <div>
      <h2 className="page-title">Documents</h2>
      <p className="page-sub">Photograph or upload paperwork here so nothing gets lost in the cab.</p>
      <div className="stack">
        {SECTIONS.map((s) => (
          <Section key={s.key} meta={s} docs={docs.filter((d) => d.section === s.key)} refresh={refresh} />
        ))}
      </div>
    </div>
  );
}

function Section({ meta, docs, refresh }) {
  const input = useRef();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  const onFiles = async (files) => {
    setBusy(true); setErr("");
    try {
      for (const f of files) await uploadDocument(meta.key, f);
      refresh();
    } catch (e) { setErr(e.message || "Upload failed. Check your connection."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };

  const openDoc = async (d) => {
    try { window.open(await documentUrl(d.path), "_blank"); }
    catch { setErr("Could not open that file right now."); }
  };

  return (
    <div className="card">
      <div className="between">
        <button style={{ all: "unset", cursor: "pointer", flex: 1 }} onClick={() => setOpen(!open)}>
          <div className="row">
            <span style={{ color: "var(--gold-3)" }}>{Icon.doc(20)}</span>
            <div>
              <div style={{ fontWeight: 700 }}>{meta.label} <span className="muted">({docs.length})</span></div>
              <div className="muted" style={{ fontSize: 12 }}>{meta.note}</div>
            </div>
          </div>
        </button>
        <button className="btn ghost small" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Uploading…" : <>{Icon.plus(14)} Add</>}
        </button>
      </div>
      <input ref={input} type="file" multiple accept="image/*,.pdf" style={{ display: "none" }}
        onChange={(e) => e.target.files.length && onFiles([...e.target.files])} />
      {err && <p className="error-text" style={{ marginTop: 8 }}>{err}</p>}
      {open && (
        docs.length === 0 ? <p className="muted" style={{ marginTop: 10 }}>Nothing here yet.</p> : (
          <div style={{ marginTop: 10 }}>
            {docs.map((d) => (
              <div key={d.id} className="between" style={{ padding: "8px 0", borderTop: "1px solid var(--hairline)" }}>
                <button style={{ all: "unset", cursor: "pointer" }} onClick={() => openDoc(d)}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{fmtDate(d.uploaded_at)}</div>
                </button>
                <button className="modal-close" aria-label="Delete document"
                  onClick={async () => { if (confirm("Delete this document?")) { await deleteDocument(d); refresh(); } }}>
                  {Icon.trash(16)}
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
