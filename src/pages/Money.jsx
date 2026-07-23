import React, { useState } from "react";
import { Field, Icon, Modal } from "../components/ui.jsx";
import { fmtDate, matchDiscount, matchTripByDate, money } from "../lib/calc.js";
import { addExpense, addIncome } from "../lib/store.js";

const EXPENSES = [
  { key: "fuel", label: "Fuel", icon: "fuel", note: "Diesel or reefer fuel, UT card or your own money." },
  { key: "toll", label: "Tolls", icon: "toll", note: "Road, bridge and gantry charges." },
  { key: "repairs", label: "Repairs & auto parts", icon: "wrench", note: "Mechanic work and parts bought." },
  { key: "wash", label: "Truck wash", icon: "droplets", note: "Washouts and exterior washes." },
  { key: "weighing", label: "Weighing fees", icon: "scale", note: "CAT scale and weigh station charges." },
  { key: "penalty", label: "Penalties", icon: "alert", note: "Fines, late fees, violations." },
  { key: "insurance", label: "Insurance", icon: "shield", note: "Insurance charged by United Transport." },
  { key: "escrow", label: "Escrow", icon: "vault", note: "Escrow amounts held by United Transport." },
];

const INCOMES = [
  { key: "fuel_discount", label: "Fuel discounts", icon: "tag", note: "From the weekly UT LLC receipt — known only after it arrives on Friday. Matched to a trip by load number." },
  { key: "refund", label: "Refunds", icon: "undo", note: "Money paid back to you, e.g. after fueling with your own money." },
];

export default function Money({ trips, refresh }) {
  const [modal, setModal] = useState(null); // { type: 'expense'|'income', key }

  return (
    <div>
      <h2 className="page-title">Money</h2>
      <p className="page-sub">
        Tap a card to record a cost or an income. Each entry drops into the right trip on its own,
        matched by date and time.
      </p>

      <div style={{ fontWeight: 700, margin: "6px 2px 10px" }}>Expenses</div>
      <div className="grid-2">
        {EXPENSES.map((c) => (
          <button key={c.key} className="card clickable" onClick={() => setModal({ type: "expense", key: c.key })}>
            <span style={{ color: "var(--gold-3)" }}>{Icon[c.icon](24)}</span>
            <div style={{ fontWeight: 700, margin: "6px 0 2px" }}>{c.label}</div>
            <div className="muted" style={{ fontSize: 12 }}>{c.note}</div>
          </button>
        ))}
      </div>

      <div style={{ fontWeight: 700, margin: "20px 2px 10px" }}>Income</div>
      <div className="grid-2">
        {INCOMES.map((c) => (
          <button key={c.key} className="card clickable" onClick={() => setModal({ type: "income", key: c.key })}>
            <span style={{ color: "var(--gold-3)" }}>{Icon[c.icon](24)}</span>
            <div style={{ fontWeight: 700, margin: "6px 0 2px" }}>{c.label}</div>
            <div className="muted" style={{ fontSize: 12 }}>{c.note}</div>
          </button>
        ))}
      </div>
      <p className="muted" style={{ margin: "16px 2px 0" }}>
        Trip pay itself is automatic: each saved trip already counts its amount after the 20% cut as income.
      </p>

      {modal?.type === "expense" && (
        <ExpenseModal cat={modal.key} trips={trips} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />
      )}
      {modal?.key === "fuel_discount" && (
        <DiscountModal trips={trips} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />
      )}
      {modal?.key === "refund" && (
        <RefundModal trips={trips} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />
      )}
    </div>
  );
}

/* ---------- one modal per expense, fuel gets extra fields ---------- */
function ExpenseModal({ cat, trips, onClose, onSaved }) {
  const meta = EXPENSES.find((e) => e.key === cat);
  const [at, setAt] = useState("");
  const [location, setLocation] = useState("");
  const [amount, setAmount] = useState("");
  const [fuelType, setFuelType] = useState("diesel");
  const [paidWith, setPaidWith] = useState("broker_card");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const matched = at ? matchTripByDate(trips, at) : null;

  const save = async () => {
    setBusy(true); setErr("");
    try {
      await addExpense({
        category: cat, amount: Number(amount), at,
        location: location.trim() || null,
        trip_id: matched?.id || null,
        fuel_type: cat === "fuel" ? fuelType : null,
        paid_with: cat === "fuel" ? paidWith : null,
        note: note.trim() || null,
      });
      onSaved();
    } catch (e) { setErr(e.message || "Could not save."); setBusy(false); }
  };

  return (
    <Modal title={`Add ${meta.label.toLowerCase()}`} onClose={onClose}>
      <Field label="Exact date & time" hint="When you paid. This is what places the cost inside the right trip.">
        <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
      </Field>
      <Field label="Location" hint="Where it happened, e.g. the truck stop or shop name and city.">
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Pilot, Ellensburg WA" />
      </Field>
      <Field label="Amount" hint="Dollar amount on the receipt.">
        <input type="number" inputMode="decimal" min="0" step="0.01" value={amount}
          onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 412.60" />
      </Field>

      {cat === "fuel" && (
        <>
          <Field label="Fuel type" hint="Diesel moves the truck; reefer fuel runs the trailer cooler.">
            <div className="seg">
              <button type="button" className={fuelType === "diesel" ? "on" : ""} onClick={() => setFuelType("diesel")}>Diesel</button>
              <button type="button" className={fuelType === "reefer" ? "on" : ""} onClick={() => setFuelType("reefer")}>Reefer</button>
            </div>
          </Field>
          <Field label="Paid with" hint="Own money means a refund may come later — record it under Income when it does.">
            <div className="seg">
              <button type="button" className={paidWith === "broker_card" ? "on" : ""} onClick={() => setPaidWith("broker_card")}>UT LLC card</button>
              <button type="button" className={paidWith === "own" ? "on" : ""} onClick={() => setPaidWith("own")}>My own money</button>
            </div>
          </Field>
        </>
      )}

      <Field label="Note (optional)" hint="Anything worth remembering about this cost.">
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      {at && (
        <p className="muted" style={{ marginBottom: 12 }}>
          {matched
            ? <>Will be filed under the <b>{matched.broker}</b> trip of {fmtDate(matched.first_pickup)}.</>
            : "No trip covers this date yet — it will be saved as a general cost and can still be seen in Summaries."}
        </p>
      )}
      {err && <p className="error-text">{err}</p>}
      <button className="btn" style={{ width: "100%" }} disabled={!at || !(Number(amount) > 0) || busy} onClick={save}>
        {busy ? "Saving…" : "Save expense"}
      </button>
    </Modal>
  );
}

/* ---------- fuel discount (date + load number only, from weekly receipt) ---------- */
function DiscountModal({ trips, onClose, onSaved }) {
  const [onDate, setOnDate] = useState("");
  const [loadNumber, setLoadNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const matched = matchDiscount(trips, loadNumber, onDate);

  const save = async () => {
    setBusy(true); setErr("");
    try {
      await addIncome({
        kind: "fuel_discount", amount: Number(amount), on_date: onDate,
        load_number: loadNumber.trim() || null, trip_id: matched?.id || null,
      });
      onSaved();
    } catch (e) { setErr(e.message || "Could not save."); setBusy(false); }
  };

  return (
    <Modal title="Add fuel discount" onClose={onClose}>
      <p className="muted" style={{ marginBottom: 12 }}>
        These come from the United Transport receipt that arrives the Friday after each
        Monday–Sunday week, so enter them once you have that receipt in hand.
      </p>
      <Field label="Date on the receipt" hint="The receipt shows a date only, no time.">
        <input type="date" value={onDate} onChange={(e) => setOnDate(e.target.value)} />
      </Field>
      <Field label="Load number" hint="The load number UT LLC printed next to this discount — it links the discount to the right trip.">
        <input value={loadNumber} onChange={(e) => setLoadNumber(e.target.value)} placeholder="e.g. UT-48213" />
      </Field>
      <Field label="Discount amount" hint="The dollar amount of the discount.">
        <input type="number" inputMode="decimal" min="0" step="0.01" value={amount}
          onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 36.20" />
      </Field>
      {(loadNumber || onDate) && (
        <p className="muted" style={{ marginBottom: 12 }}>
          {matched
            ? <>Matched to the <b>{matched.broker}</b> trip{matched.load_number ? <> (load {matched.load_number})</> : null}.</>
            : "No trip matches this load number or date yet — it will still count in your income totals."}
        </p>
      )}
      {err && <p className="error-text">{err}</p>}
      <button className="btn" style={{ width: "100%" }} disabled={!onDate || !(Number(amount) > 0) || busy} onClick={save}>
        {busy ? "Saving…" : "Save discount"}
      </button>
    </Modal>
  );
}

/* ---------- refunds ---------- */
function RefundModal({ trips, onClose, onSaved }) {
  const [onDate, setOnDate] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const matched = onDate ? matchTripByDate(trips, onDate) : null;

  const save = async () => {
    setBusy(true); setErr("");
    try {
      await addIncome({
        kind: "refund", amount: Number(amount), on_date: onDate,
        note: note.trim() || null, trip_id: matched?.id || null,
      });
      onSaved();
    } catch (e) { setErr(e.message || "Could not save."); setBusy(false); }
  };

  return (
    <Modal title="Add refund" onClose={onClose}>
      <Field label="Date received" hint="The day the money came back to you.">
        <input type="date" value={onDate} onChange={(e) => setOnDate(e.target.value)} />
      </Field>
      <Field label="Amount" hint="How much was paid back.">
        <input type="number" inputMode="decimal" min="0" step="0.01" value={amount}
          onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 180.00" />
      </Field>
      <Field label="What it was for" hint="e.g. fuel paid with own money on the Boise trip.">
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {err && <p className="error-text">{err}</p>}
      <button className="btn" style={{ width: "100%" }} disabled={!onDate || !(Number(amount) > 0) || busy} onClick={save}>
        {busy ? "Saving…" : "Save refund"}
      </button>
    </Modal>
  );
}

export { EXPENSES };
