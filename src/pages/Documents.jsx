import React, { useRef, useState } from "react";
import { Empty, Field, Icon, Modal } from "../components/ui.jsx";
import { computeLegs, findPriorTrip, fmtDate, matchTripByDate, money, num, splitPay } from "../lib/calc.js";
import { readDocument } from "../lib/ai.js";
import { geocode } from "../lib/geo.js";
import { addExpense, deleteDocument, documentUrl, saveTrip, uploadDocument } from "../lib/store.js";

const SECTIONS = [
  { key: "ratecon", label: "Rate confirmations", note: "The rate con paperwork for each trip." },
  { key: "fuel_receipt", label: "Fuel receipts", note: "Pump receipts, diesel and reefer." },
  { key: "broker_receipt", label: "Broker weekly receipts", note: "The Friday receipts from United Transport or other brokers." },
  { key: "own_fuel_receipt", label: "Own-money fuel receipts", note: "Times you fueled with your own money instead of the UT card." },
  { key: "expense_receipt", label: "Expense receipts", note: "Repairs, parts, washes, scales, tolls and the rest." },
  { key: "other", label: "Other documents", note: "Anything else worth keeping safe." },
];

export default function Documents({ docs, trips = [], refresh }) {
  const [scanning, setScanning] = useState(false);
  return (
    <div>
      <h2 className="page-title">Documents</h2>
      <p className="page-sub">Photograph or upload paperwork here so nothing gets lost in the cab.</p>

      <button className="btn" style={{ width: "100%", marginBottom: 16 }} onClick={() => setScanning(true)}>
        {Icon.doc(18)} Scan a document &amp; fill the data for me
      </button>

      <div className="stack">
        {SECTIONS.map((s) => (
          <Section key={s.key} meta={s} docs={docs.filter((d) => d.section === s.key)} refresh={refresh} />
        ))}
      </div>

      {scanning && <ScanModal trips={trips} refresh={refresh} onClose={() => setScanning(false)} />}
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

/* ================= Scan & auto-fill ================= */

const CAT_OPTIONS = [
  ["toll", "Tolls"], ["repairs", "Repairs & auto parts"], ["wash", "Truck wash"],
  ["weighing", "Weighing fees"], ["penalty", "Penalties"], ["insurance", "Insurance"], ["escrow", "Escrow"],
];

function ScanModal({ trips, refresh, onClose }) {
  const input = useRef();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null); // parsed data, editable
  const [savedMsg, setSavedMsg] = useState("");

  const scan = async (f) => {
    setFile(f); setErr(""); setResult(null); setSavedMsg("");
    setBusy("Reading the document…");
    try {
      const data = await readDocument(f);
      if (data.type === "unknown") throw new Error(data.reason || "Could not tell what this document is.");
      setResult(data);
    } catch (e) { setErr(e.message || "Scan failed."); }
    finally { setBusy(""); }
  };

  return (
    <Modal title="Scan a document" onClose={onClose} wide>
      {!result && !savedMsg && (
        <>
          <p className="muted" style={{ marginBottom: 14 }}>
            Pick a photo or PDF of a rate confirmation, fuel receipt, or any expense receipt.
            The reader pulls out the details, you check them, and only then is anything saved.
          </p>
          <button className="btn ghost" style={{ width: "100%" }} disabled={!!busy} onClick={() => input.current?.click()}>
            {busy || (file ? `Scan again: ${file.name}` : "Choose photo or PDF")}
          </button>
          <input ref={input} type="file" accept="image/*,.pdf" style={{ display: "none" }}
            onChange={(e) => e.target.files[0] && scan(e.target.files[0])} />
          {err && <p className="error-text" style={{ marginTop: 10 }}>{err}</p>}
        </>
      )}

      {result?.type === "ratecon" && (
        <RateconReview data={result} file={file} trips={trips}
          onDone={(msg) => { setResult(null); setSavedMsg(msg); refresh(); }} />
      )}
      {result?.type === "fuel" && (
        <FuelReview data={result} file={file} trips={trips}
          onDone={(msg) => { setResult(null); setSavedMsg(msg); refresh(); }} />
      )}
      {result?.type === "expense" && (
        <ExpenseReview data={result} file={file} trips={trips}
          onDone={(msg) => { setResult(null); setSavedMsg(msg); refresh(); }} />
      )}

      {savedMsg && (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <p style={{ fontWeight: 700, marginBottom: 14 }}>{savedMsg}</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="btn ghost small" onClick={() => { setSavedMsg(""); setFile(null); }}>Scan another</button>
            <button className="btn small" onClick={onClose}>Done</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function RateconReview({ data, file, trips, onDone }) {
  const [broker, setBroker] = useState(data.broker || "");
  const [loadNumber, setLoadNumber] = useState(data.load_number || "");
  const [rateconDate, setRateconDate] = useState(data.ratecon_date || "");
  const [gross, setGross] = useState(data.gross_pay ?? "");
  const [stops, setStops] = useState((data.stops || []).map((s) => ({
    kind: s.kind === "delivery" ? "delivery" : "pickup",
    at: s.datetime || "", address: s.address || "",
  })));
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const setStop = (i, patch) => setStops(stops.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const pay = splitPay(gross);
  const ready = broker.trim() && rateconDate && pay.gross > 0 &&
    stops.length >= 2 && stops.every((s) => s.at && s.address.trim());

  const create = async () => {
    setErr("");
    try {
      setBusy("Finding each address on the map…");
      const resolved = [];
      for (const s of stops) {
        const g = await geocode(s.address);
        if (!g) throw new Error(`Could not find "${s.address}" on the map. Edit it to a fuller address (street, city, state).`);
        resolved.push({ kind: s.kind, at: s.at, address: s.address, resolved: g.label, state: g.state, lat: g.lat, lon: g.lon });
      }
      resolved.sort((a, b) => new Date(a.at) - new Date(b.at));

      setBusy("Measuring loaded and empty miles…");
      const prior = findPriorTrip(trips, resolved[0].at);
      const prevDelivery = prior
        ? [...(prior.stops || [])].filter((s) => s.kind === "delivery" && s.lat != null)
            .sort((a, b) => new Date(a.at) - new Date(b.at)).slice(-1)[0]
        : null;
      const { legs, loadedMiles, emptyMiles } = await computeLegs(resolved, prevDelivery);

      setBusy("Saving the trip…");
      await saveTrip(
        {
          broker: broker.trim(), load_number: loadNumber.trim() || null, ratecon_date: rateconDate,
          gross_pay: pay.gross, net_pay: pay.net,
          loaded_miles: loadedMiles, empty_miles: emptyMiles, legs,
          first_pickup: resolved.find((s) => s.kind === "pickup")?.at,
          last_delivery: [...resolved].reverse().find((s) => s.kind === "delivery")?.at,
        },
        resolved
      );
      if (file) { setBusy("Filing the document…"); await uploadDocument("ratecon", file); }
      onDone(`Trip saved — ${num(loadedMiles)} loaded mi, ${money(pay.net)} to you. The rate con is filed under Documents.`);
    } catch (e) { setErr(e.message || "Could not create the trip."); }
    finally { setBusy(""); }
  };

  return (
    <>
      <p className="muted" style={{ marginBottom: 12 }}>
        This looks like a <b>rate confirmation</b>. Check every field against the paper before saving.
      </p>
      <Field label="Company offering the load"><input value={broker} onChange={(e) => setBroker(e.target.value)} /></Field>
      <div className="grid-2">
        <Field label="Load number"><input value={loadNumber} onChange={(e) => setLoadNumber(e.target.value)} /></Field>
        <Field label="Rate con date"><input type="date" value={rateconDate} onChange={(e) => setRateconDate(e.target.value)} /></Field>
      </div>
      <Field label="Gross pay (before the 20%)" hint={pay.gross > 0 ? `After the 20% cut: ${money(pay.net)} to you.` : ""}>
        <input type="number" inputMode="decimal" min="0" step="0.01" value={gross} onChange={(e) => setGross(e.target.value)} />
      </Field>

      <div style={{ fontWeight: 700, margin: "4px 0 8px" }}>Stops the reader found</div>
      {stops.map((s, i) => (
        <div key={i} className="card" style={{ marginBottom: 10 }}>
          <div className="between" style={{ marginBottom: 8 }}>
            <div className="seg" style={{ maxWidth: 220 }}>
              <button type="button" className={s.kind === "pickup" ? "on" : ""} onClick={() => setStop(i, { kind: "pickup" })}>Pickup</button>
              <button type="button" className={s.kind === "delivery" ? "on" : ""} onClick={() => setStop(i, { kind: "delivery" })}>Delivery</button>
            </div>
            <button className="modal-close" aria-label="Remove stop" onClick={() => setStops(stops.filter((_, j) => j !== i))}>{Icon.trash(16)}</button>
          </div>
          <Field label="Date & time"><input type="datetime-local" value={s.at} onChange={(e) => setStop(i, { at: e.target.value })} /></Field>
          <Field label="Address" hint="Fix anything the reader got wrong — a full street, city, state works best.">
            <input value={s.address} onChange={(e) => setStop(i, { address: e.target.value })} />
          </Field>
        </div>
      ))}
      <button className="btn ghost small" style={{ marginBottom: 14 }}
        onClick={() => setStops([...stops, { kind: "delivery", at: "", address: "" }])}>{Icon.plus(14)} Add a stop</button>

      {err && <p className="error-text">{err}</p>}
      <button className="btn" style={{ width: "100%" }} disabled={!ready || !!busy} onClick={create}>
        {busy || "Everything matches — create this trip"}
      </button>
    </>
  );
}

function FuelReview({ data, file, trips, onDone }) {
  const [at, setAt] = useState(data.datetime || "");
  const [location, setLocation] = useState(data.location || "");
  const [amount, setAmount] = useState(data.amount ?? "");
  const [fuelType, setFuelType] = useState(data.fuel_type === "reefer" ? "reefer" : "diesel");
  const [paidWith, setPaidWith] = useState("broker_card");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const matched = at ? matchTripByDate(trips, at) : null;

  const save = async () => {
    setBusy(true); setErr("");
    try {
      await addExpense({
        category: "fuel", amount: Number(amount), at, location: location.trim() || null,
        trip_id: matched?.id || null, fuel_type: fuelType, paid_with: paidWith, note: "Scanned from receipt",
      });
      if (file) await uploadDocument(paidWith === "own" ? "own_fuel_receipt" : "fuel_receipt", file);
      onDone(`Fuel of ${money(Number(amount))} saved${matched ? ` under the ${matched.broker} trip` : ""}. Receipt filed under Documents.`);
    } catch (e) { setErr(e.message || "Could not save."); setBusy(false); }
  };

  return (
    <>
      <p className="muted" style={{ marginBottom: 12 }}>This looks like a <b>fuel receipt</b>. Check the details, pick how it was paid, then save.</p>
      <Field label="Date & time"><input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></Field>
      <Field label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
      <Field label="Amount"><input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Fuel type">
        <div className="seg">
          <button type="button" className={fuelType === "diesel" ? "on" : ""} onClick={() => setFuelType("diesel")}>Diesel</button>
          <button type="button" className={fuelType === "reefer" ? "on" : ""} onClick={() => setFuelType("reefer")}>Reefer</button>
        </div>
      </Field>
      <Field label="Paid with">
        <div className="seg">
          <button type="button" className={paidWith === "broker_card" ? "on" : ""} onClick={() => setPaidWith("broker_card")}>UT LLC card</button>
          <button type="button" className={paidWith === "own" ? "on" : ""} onClick={() => setPaidWith("own")}>My own money</button>
        </div>
      </Field>
      {at && (
        <p className="muted" style={{ marginBottom: 12 }}>
          {matched ? <>Will be filed under the <b>{matched.broker}</b> trip.</> : "No trip covers this date — it will be saved as a general cost."}
        </p>
      )}
      {err && <p className="error-text">{err}</p>}
      <button className="btn" style={{ width: "100%" }} disabled={!at || !(Number(amount) > 0) || busy} onClick={save}>
        {busy ? "Saving…" : "Everything matches — save this fuel"}
      </button>
    </>
  );
}

function ExpenseReview({ data, file, trips, onDone }) {
  const [category, setCategory] = useState(CAT_OPTIONS.some(([k]) => k === data.category) ? data.category : "toll");
  const [at, setAt] = useState(data.datetime || "");
  const [location, setLocation] = useState(data.location || "");
  const [amount, setAmount] = useState(data.amount ?? "");
  const [note, setNote] = useState(data.note || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const matched = at ? matchTripByDate(trips, at) : null;

  const save = async () => {
    setBusy(true); setErr("");
    try {
      await addExpense({
        category, amount: Number(amount), at, location: location.trim() || null,
        trip_id: matched?.id || null, note: note.trim() || "Scanned from receipt",
      });
      if (file) await uploadDocument("expense_receipt", file);
      onDone(`Expense of ${money(Number(amount))} saved${matched ? ` under the ${matched.broker} trip` : ""}. Receipt filed under Documents.`);
    } catch (e) { setErr(e.message || "Could not save."); setBusy(false); }
  };

  return (
    <>
      <p className="muted" style={{ marginBottom: 12 }}>This looks like an <b>expense receipt</b>. Check the type and details, then save.</p>
      <Field label="Type of expense">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CAT_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <Field label="Date & time"><input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></Field>
      <Field label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
      <Field label="Amount"><input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {at && (
        <p className="muted" style={{ marginBottom: 12 }}>
          {matched ? <>Will be filed under the <b>{matched.broker}</b> trip.</> : "No trip covers this date — it will be saved as a general cost."}
        </p>
      )}
      {err && <p className="error-text">{err}</p>}
      <button className="btn" style={{ width: "100%" }} disabled={!at || !(Number(amount) > 0) || busy} onClick={save}>
        {busy ? "Saving…" : "Everything matches — save this expense"}
      </button>
    </>
  );
}
