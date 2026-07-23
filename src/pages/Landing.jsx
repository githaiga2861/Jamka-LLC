import React, { useRef, useState } from "react";
import { Icon, Modal } from "../components/ui.jsx";
import { checkPin } from "../lib/store.js";
import { configured } from "../lib/supabase.js";

export default function Landing({ onSignedIn }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="landing">
      <div className="landing-hero">
        <img src="./icons/icon.svg" alt="" width="88" height="88"
          style={{ borderRadius: 20, boxShadow: "var(--shadow-deep)" }} />
        <div>
          <div className="brand-sub">Est. Washington State</div>
          <h1>JAMKA LLC</h1>
        </div>
        <div className="gold-rule" />
        <p className="tagline">
          One truck. Every dollar accounted for. Trips, miles, fuel and pay — kept
          straight so profit is never a guess.
        </p>
        <button className="btn" style={{ minWidth: 220 }} onClick={() => setOpen(true)}>
          Sign in {Icon.chevron(16)}
        </button>
        {!configured && (
          <p className="error-text" style={{ maxWidth: 320 }}>
            Supabase is not connected yet. Add your keys to the .env file (see README) and rebuild.
          </p>
        )}
      </div>

      <div className="landing-features">
        <div className="feature card">{Icon.route(24)}<div>Exact loaded &amp; empty miles</div></div>
        <div className="feature card">{Icon.wallet(24)}<div>Pay after the 20% cut, automatic</div></div>
        <div className="feature card">{Icon.folder(24)}<div>Receipts saved, never lost</div></div>
      </div>
      <div className="landing-foot">Private books for Jamka LLC. Authorized use only.</div>

      {open && <PinModal onClose={() => setOpen(false)} onSignedIn={onSignedIn} />}
    </div>
  );
}

function PinModal({ onClose, onSignedIn }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const refs = [useRef(), useRef(), useRef(), useRef()];

  const setDigit = (i, v) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    setErr("");
    if (d && i < 3) refs[i + 1].current?.focus();
    if (next.every(Boolean)) submit(next.join(""));
  };

  const submit = async (pin) => {
    setBusy(true);
    try {
      const ok = await checkPin(pin);
      if (ok) onSignedIn();
      else { setErr("That PIN is not right. Try again."); setDigits(["", "", "", ""]); refs[0].current?.focus(); }
    } catch {
      setErr("Could not reach the server. Check your connection and Supabase setup.");
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Enter your PIN" onClose={onClose}>
      <p className="muted" style={{ marginBottom: 12 }}>
        The same 4-digit PIN works on every device you sign in from.
      </p>
      <div className="pin-boxes">
        {digits.map((d, i) => (
          <input
            key={i} ref={refs[i]} className="pin-box" inputMode="numeric" value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => e.key === "Backspace" && !d && i > 0 && refs[i - 1].current?.focus()}
            autoFocus={i === 0}
          />
        ))}
      </div>
      {busy && <p className="muted" style={{ textAlign: "center" }}>Checking…</p>}
      {err && <p className="error-text" style={{ textAlign: "center" }}>{err}</p>}
    </Modal>
  );
}
