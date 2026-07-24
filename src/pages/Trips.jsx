import React, { useMemo, useState } from "react";
import { AddressField, Empty, Field, Icon, Modal } from "../components/ui.jsx";
import { computeLegs, findPriorTrip, fmtDate, fmtDateTime, matchTripByDate, money, num, splitPay } from "../lib/calc.js";
import { deleteTrip, recomputeAllMileage, saveTrip } from "../lib/store.js";

const CAT_LABEL = {
  fuel: "Fuel", toll: "Tolls", repairs: "Repairs & auto parts", wash: "Truck wash",
  weighing: "Weighing fees", penalty: "Penalties", insurance: "Insurance", escrow: "Escrow",
};

export default function Trips({ trips, expenses, incomes, refresh }) {
  const [adding, setAdding] = useState(false);
  const [openTrip, setOpenTrip] = useState(null);
  const [recalcing, setRecalcing] = useState(false);

  const recalcAll = async () => {
    setRecalcing(true);
    try { await recomputeAllMileage(trips); await refresh(); }
    finally { setRecalcing(false); }
  };

  return (
    <div>
      <div className="between">
        <div>
          <h2 className="page-title">Trips</h2>
          <p className="page-sub">Every rate confirmation, its miles and its money.</p>
        </div>
        <button className="btn small" onClick={() => setAdding(true)}>{Icon.plus(16)} New trip</button>
      </div>

      {trips.length > 1 && (
        <button className="btn ghost small" style={{ marginBottom: 14 }} disabled={recalcing} onClick={recalcAll}>
          {recalcing ? "Recalculating every trip's miles…" : <>{Icon.route(15)} Recalculate all mileage</>}
        </button>
      )}

      {trips.length === 0 ? (
        <Empty text="No trips yet. Tap New trip to enter your first rate confirmation." />
      ) : (
        <div className="list-wrap">
          {trips.map((t, i) => {
            const from = t.stops?.find((s) => s.kind === "pickup");
            const to = [...(t.stops || [])].reverse().find((s) => s.kind === "delivery");
            return (
              <button key={t.id} className="list-item" onClick={() => setOpenTrip(t)}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    <span className="gold-text">#{trips.length - i}</span>{" "}
                    {from?.state || "?"} → {to?.state || "?"}
                    <span className="muted" style={{ fontWeight: 500 }}> · {t.broker}</span>
                  </div>
                  <div className="muted">
                    {t.first_pickup ? fmtDate(t.first_pickup) : "?"}
                    {" → "}
                    {t.last_delivery ? fmtDate(t.last_delivery) : "?"}
                  </div>
                  <div className="muted">
                    {num(t.loaded_miles)} loaded mi
                    {t.empty_miles > 0 && <> · {num(t.empty_miles)} empty mi</>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>{money(t.net_pay)}</div>
                  <div className="muted">of {money(t.gross_pay)}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {adding && <NewTripWizard trips={trips} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); refresh(); }} />}
      {openTrip && (
        <TripProfile
          trip={openTrip} expenses={expenses} incomes={incomes}
          onClose={() => setOpenTrip(null)}
          onDeleted={() => { setOpenTrip(null); refresh(); }}
        />
      )}
    </div>
  );
}

/* ================= New trip wizard ================= */

const blankStop = (kind) => ({ kind, at: "", loc: { address: "", lat: null, lon: null, resolved: null, state: "" } });

function NewTripWizard({ trips, onClose, onSaved }) {
  const [step, setStep] = useState(0);
  const [broker, setBroker] = useState("");
  const [loadNumber, setLoadNumber] = useState("");
  const [rateconDate, setRateconDate] = useState("");
  const [pickups, setPickups] = useState([blankStop("pickup")]);
  const [deliveries, setDeliveries] = useState([blankStop("delivery")]);
  const [gross, setGross] = useState("");
  const [calc, setCalc] = useState(null); // { legs, loadedMiles, emptyMiles }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pay = splitPay(gross);

  const stopsReady =
    pickups.every((s) => s.at && s.loc.address) &&
    deliveries.every((s) => s.at && s.loc.address);

  const allStops = () =>
    [...pickups, ...deliveries]
      .map((s) => ({ kind: s.kind, at: s.at, ...s.loc }))
      .sort((a, b) => new Date(a.at) - new Date(b.at));

  const runMath = async () => {
    setBusy(true); setErr("");
    try {
      // resolve any address the user typed but didn't tap a suggestion for
      const { geocode } = await import("../lib/geo.js");
      const stops = allStops();
      for (const s of stops) {
        if (s.lat == null && s.address) {
          const g = await geocode(s.address);
          if (g) Object.assign(s, { lat: g.lat, lon: g.lon, resolved: g.label, state: g.state });
        }
        if (s.lat == null) throw new Error(`Could not find "${s.address}" on the map. Check the spelling or add the city and state.`);
      }
      // most recently ended trip's last delivery = start point for empty miles
      const prior = findPriorTrip(trips, stops[0].at);
      const prevDelivery = prior
        ? [...prior.stops].reverse().find((s) => s.kind === "delivery" && s.lat != null)
        : null;

      const result = await computeLegs(stops, prevDelivery);
      setCalc({ ...result, stops });
      setStep(3);
    } catch (e) {
      setErr(e.message || "Something went wrong while measuring the route.");
    } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const stops = calc.stops;
      await saveTrip(
        {
          broker: broker.trim(),
          load_number: loadNumber.trim() || null,
          ratecon_date: rateconDate,
          gross_pay: pay.gross,
          net_pay: pay.net,
          loaded_miles: calc.loadedMiles,
          empty_miles: calc.emptyMiles,
          legs: calc.legs,
          first_pickup: stops.find((s) => s.kind === "pickup")?.at,
          last_delivery: [...stops].reverse().find((s) => s.kind === "delivery")?.at,
        },
        stops.map((s) => ({
          kind: s.kind, at: s.at, address: s.address, resolved: s.resolved,
          state: s.state, lat: s.lat, lon: s.lon,
        }))
      );
      onSaved();
    } catch (e) { setErr(e.message || "Could not save the trip."); setBusy(false); }
  };

  const steps = ["Rate con", "Stops", "Pay", "Check"];

  return (
    <Modal title={`New trip — ${steps[step]}`} onClose={onClose} wide>
      <div className="step-dots">
        {steps.map((_, i) => <div key={i} className={`step-dot ${i <= step ? "on" : ""}`} />)}
      </div>

      {step === 0 && (
        <>
          <Field label="Company offering the load" hint="The broker's name or initials as shown on the rate confirmation, e.g. UT LLC.">
            <input value={broker} onChange={(e) => setBroker(e.target.value)} placeholder="e.g. United Transport LLC" />
          </Field>
          <Field label="Load number (optional)" hint="The load / reference number on the rate con. It later matches fuel discounts to this trip automatically.">
            <input value={loadNumber} onChange={(e) => setLoadNumber(e.target.value)} placeholder="e.g. UT-48213" />
          </Field>
          <Field label="Date you received the rate con" hint="The day this rate confirmation reached you.">
            <input type="date" value={rateconDate} onChange={(e) => setRateconDate(e.target.value)} />
          </Field>
          <button className="btn" style={{ width: "100%" }} disabled={!broker.trim() || !rateconDate} onClick={() => setStep(1)}>
            Next: pickups &amp; deliveries {Icon.chevron(16)}
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <StopGroup
            title="Pickups" stops={pickups} setStops={setPickups} kind="pickup"
            hint="Exact date, time and address where you load. Add another pickup if this rate con has more than one."
          />
          <div className="divider" />
          <StopGroup
            title="Deliveries" stops={deliveries} setStops={setDeliveries} kind="delivery"
            hint="Exact date, time and address where you drop off. A trip can have more deliveries than pickups, or the other way round."
          />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn ghost" onClick={() => setStep(0)}>{Icon.back(16)} Back</button>
            <button className="btn" style={{ flex: 1 }} disabled={!stopsReady} onClick={() => setStep(2)}>
              Next: pay {Icon.chevron(16)}
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <Field label="Gross pay on the rate con" hint="The full amount written on the rate confirmation, before United Transport takes its 20%.">
            <input type="number" inputMode="decimal" min="0" step="0.01" value={gross}
              onChange={(e) => setGross(e.target.value)} placeholder="e.g. 3200.00" />
          </Field>
          {pay.gross > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <table className="mini">
                <tbody>
                  <tr><td>Gross pay</td><td>{money(pay.gross)}</td></tr>
                  <tr><td>United Transport keeps 20%</td><td>− {money(pay.cut)}</td></tr>
                  <tr><td><b>Comes to you</b></td><td><b className="gold-text">{money(pay.net)}</b></td></tr>
                </tbody>
              </table>
            </div>
          )}
          {err && <p className="error-text">{err}</p>}
          <div className="row">
            <button className="btn ghost" onClick={() => setStep(1)}>{Icon.back(16)} Back</button>
            <button className="btn" style={{ flex: 1 }} disabled={!(pay.gross > 0) || busy} onClick={runMath}>
              {busy ? "Measuring the route…" : <>See the math {Icon.chevron(16)}</>}
            </button>
          </div>
        </>
      )}

      {step === 3 && calc && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="between"><span className="muted">Pay after the 20% cut</span><b>{money(pay.net)}</b></div>
            <div className="between"><span className="muted">United Transport keeps</span><span>{money(pay.cut)}</span></div>
            <div className="divider" />
            <div className="between"><span className="muted">Total loaded miles</span><b>{num(calc.loadedMiles)} mi</b></div>
            <div className="between"><span className="muted">Total empty miles</span><b>{num(calc.emptyMiles)} mi</b></div>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Every stretch, measured separately</div>
            <table className="mini">
              <tbody>
                {calc.legs.map((l, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`pill ${l.type === "loaded" ? "dark" : ""}`}>{l.type === "loaded" ? "Loaded" : "Empty"}</span>
                      <div style={{ marginTop: 4 }}>{l.from} → {l.to}</div>
                      <div className="muted">{l.note}</div>
                    </td>
                    <td>{num(l.miles)} mi</td>
                  </tr>
                ))}
                {calc.legs.length === 0 && <tr><td className="muted">Only one stop was entered, so there is no distance to measure.</td><td /></tr>}
              </tbody>
            </table>
          </div>

          <p className="muted" style={{ marginBottom: 12 }}>Is everything above correct, or do you want to change something first?</p>
          {err && <p className="error-text">{err}</p>}
          <div className="row">
            <button className="btn ghost" onClick={() => setStep(0)}>{Icon.back(16)} Change details</button>
            <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={save}>
              {busy ? "Saving…" : <>Looks right — save trip {Icon.check(16)}</>}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function StopGroup({ title, stops, setStops, kind, hint }) {
  const update = (i, patch) => setStops(stops.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div>
      <div className="between" style={{ marginBottom: 8 }}>
        <b>{title}</b>
        <button className="btn ghost small" onClick={() => setStops([...stops, blankStop(kind)])}>
          {Icon.plus(14)} Add {kind}
        </button>
      </div>
      <p className="hint" style={{ marginBottom: 10 }}>{hint}</p>
      {stops.map((s, i) => (
        <div key={i} className="card" style={{ marginBottom: 10 }}>
          <div className="between" style={{ marginBottom: 8 }}>
            <span className="pill">{title.slice(0, -1)} {i + 1}</span>
            {stops.length > 1 && (
              <button className="modal-close" onClick={() => setStops(stops.filter((_, j) => j !== i))} aria-label="Remove stop">
                {Icon.trash(16)}
              </button>
            )}
          </div>
          <Field label="Exact date & time" hint={kind === "pickup" ? "When you load, per the rate con." : "When you must drop off, per the rate con."}>
            <input type="datetime-local" value={s.at} onChange={(e) => update(i, { at: e.target.value })} />
          </Field>
          <AddressField label="Location" value={s.loc} onPick={(loc) => update(i, { loc })} />
        </div>
      ))}
    </div>
  );
}

/* ================= Trip profile ================= */

function TripProfile({ trip, expenses, incomes, onClose, onDeleted }) {
  const tripExpenses = expenses.filter((e) => e.trip_id === trip.id);
  const tripIncomes = incomes.filter((i) => i.trip_id === trip.id);
  const spentTotal = tripExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const extraIncome = tripIncomes.reduce((s, i) => s + Number(i.amount), 0);
  const profit = Number(trip.net_pay) + extraIncome - spentTotal;

  return (
    <Modal title={`${trip.broker} trip`} onClose={onClose} wide>
      <div className="grid-2" style={{ marginBottom: 12 }}>
        <div className="card"><div className="muted">Comes to you</div><div className="kpi">{money(trip.net_pay)}</div></div>
        <div className="card"><div className="muted">Trip profit so far</div>
          <div className="kpi" style={{ color: profit >= 0 ? "var(--gold-3)" : "#a11616" }}>{money(profit)}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <table className="mini"><tbody>
          <tr><td>Rate con received</td><td>{fmtDate(trip.ratecon_date)}</td></tr>
          {trip.load_number && <tr><td>Load number</td><td>{trip.load_number}</td></tr>}
          <tr><td>Gross pay</td><td>{money(trip.gross_pay)}</td></tr>
          <tr><td>United Transport 20%</td><td>− {money(trip.gross_pay * 0.2)}</td></tr>
          <tr><td>Loaded miles</td><td>{num(trip.loaded_miles)} mi</td></tr>
          {trip.empty_miles > 0 && <tr><td>Empty miles</td><td>{num(trip.empty_miles)} mi</td></tr>}
          <tr><td>Pay per mile (all miles)</td>
            <td>{(trip.loaded_miles + trip.empty_miles) > 0 ? money(trip.gross_pay / (trip.loaded_miles + trip.empty_miles)) : "—"}/mi</td></tr>
        </tbody></table>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Stops</div>
        <table className="mini"><tbody>
          {trip.stops?.map((s) => (
            <tr key={s.id}>
              <td>
                <span className={`pill ${s.kind === "pickup" ? "dark" : ""}`}>{s.kind === "pickup" ? "Pickup" : "Delivery"}</span>
                <div style={{ marginTop: 4 }}>{s.resolved || s.address}</div>
              </td>
              <td>{fmtDateTime(s.at)}</td>
            </tr>
          ))}
        </tbody></table>
      </div>

      {trip.legs?.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Miles, stretch by stretch</div>
          <table className="mini"><tbody>
            {trip.legs.map((l, i) => (
              <tr key={i}>
                <td><span className={`pill ${l.type === "loaded" ? "dark" : ""}`}>{l.type === "loaded" ? "Loaded" : "Empty"}</span>
                  <div style={{ marginTop: 4 }}>{l.from} → {l.to}</div></td>
                <td>{num(l.miles)} mi</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Financials on this trip</div>
        <table className="mini"><tbody>
          {tripExpenses.map((e) => (
            <tr key={e.id}>
              <td>{CAT_LABEL[e.category]}{e.category === "fuel" && e.fuel_type ? ` (${e.fuel_type})` : ""}
                <div className="muted">{fmtDateTime(e.at)}{e.location ? ` · ${e.location}` : ""}
                  {e.paid_with ? ` · paid with ${e.paid_with === "own" ? "own money" : "UT card"}` : ""}</div></td>
              <td>− {money(e.amount)}</td>
            </tr>
          ))}
          {tripIncomes.map((i) => (
            <tr key={i.id}>
              <td>{i.kind === "fuel_discount" ? "Fuel discount" : "Refund"}
                <div className="muted">{fmtDate(i.on_date)}{i.load_number ? ` · load ${i.load_number}` : ""}</div></td>
              <td>+ {money(i.amount)}</td>
            </tr>
          ))}
          {tripExpenses.length + tripIncomes.length === 0 && (
            <tr><td className="muted">Nothing yet. Fuel and expenses you add in the Financials tab land here automatically when their date falls inside this trip.</td><td /></tr>
          )}
        </tbody></table>
      </div>

      <button className="btn danger small" onClick={async () => {
        if (confirm("Delete this trip and its stops? Expenses stay but lose their trip link.")) {
          await deleteTrip(trip.id); onDeleted();
        }
      }}>{Icon.trash(15)} Delete trip</button>
    </Modal>
  );
}
