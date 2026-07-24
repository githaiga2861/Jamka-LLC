import React, { useEffect, useRef, useState } from "react";
import { suggestAddresses } from "../lib/geo.js";

/* ---------------- SVG icon set (stroke, no emojis) ---------------- */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
export const Icon = {
  truck: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}>
      <path d="M1 7h12v10H1zM13 10h4l4 4v3h-8z" /><circle cx="6" cy="18.5" r="1.8" /><circle cx="17.5" cy="18.5" r="1.8" />
    </svg>
  ),
  route: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}>
      <circle cx="5" cy="18" r="2.4" /><circle cx="19" cy="6" r="2.4" /><path d="M7 17h7a4 4 0 0 0 0-8h-4" strokeDasharray="2.5 2.5" />
    </svg>
  ),
  wallet: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}>
      <rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M16 12.5h3" /><path d="M2.5 9h19" />
    </svg>
  ),
  chart: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}>
      <path d="M3 20h18" /><path d="M6 16v-5M11 16V7M16 16v-8M21 16V11" />
    </svg>
  ),
  gauge: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}>
      <path d="M4 19a9 9 0 1 1 16 0" /><path d="M12 13l3.5-3.5" /><circle cx="12" cy="13" r="1.4" />
    </svg>
  ),
  folder: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2.2 2.5H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  plus: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M12 5v14M5 12h14" /></svg>
  ),
  x: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M6 6l12 12M18 6L6 18" /></svg>
  ),
  chevron: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M9 6l6 6-6 6" /></svg>
  ),
  back: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M15 6l-6 6 6 6" /></svg>
  ),
  pin: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}>
      <path d="M12 21s-6.5-5.4-6.5-10.2A6.5 6.5 0 0 1 12 4.3a6.5 6.5 0 0 1 6.5 6.5C18.5 15.6 12 21 12 21z" /><circle cx="12" cy="10.8" r="2.2" />
    </svg>
  ),
  fuel: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}>
      <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" /><path d="M3.5 21h13" /><path d="M15 9l3.2-1.8L21 9v8.4a1.6 1.6 0 0 1-3.2 0V13H15" /><path d="M7.5 6.5h5v4h-5z" />
    </svg>
  ),
  toll: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M9 10.2c0-1.2 1.3-2 3-2s3 .8 3 2-1.2 1.7-3 2-3 .9-3 2 1.3 2 3 2 3-.8 3-2" /></svg>
  ),
  wrench: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M14.5 6.5a4.5 4.5 0 0 0-6.2 5.4L3 17.2V21h3.8l5.3-5.3a4.5 4.5 0 0 0 5.4-6.2L14.3 12l-2.3-2.3z" /></svg>
  ),
  droplets: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M8 20a4.5 4.5 0 0 0 4.5-4.5C12.5 12.5 8 8 8 8s-4.5 4.5-4.5 7.5A4.5 4.5 0 0 0 8 20z" /><path d="M17 14a3.2 3.2 0 0 0 3.2-3.2C20.2 8.6 17 5.5 17 5.5s-3.2 3.1-3.2 5.3A3.2 3.2 0 0 0 17 14z" /></svg>
  ),
  scale: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M12 4v16M4 20h16" /><path d="M6 7l6-3 6 3" /><path d="M3.5 13.5L6 7l2.5 6.5a2.7 2.7 0 0 1-5 0zM15.5 13.5L18 7l2.5 6.5a2.7 2.7 0 0 1-5 0z" /></svg>
  ),
  alert: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5" /><circle cx="12" cy="17" r="0.4" fill="currentColor" /></svg>
  ),
  shield: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M12 3l7.5 3v5.5c0 4.6-3.1 8-7.5 9.5-4.4-1.5-7.5-4.9-7.5-9.5V6z" /></svg>
  ),
  vault: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><rect x="3.5" y="4" width="17" height="16" rx="2" /><circle cx="12" cy="12" r="3.5" /><path d="M12 8.5V7M12 17v-1.5M8.5 12H7M17 12h-1.5" /></svg>
  ),
  cash: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><rect x="2.5" y="7" width="19" height="11" rx="2" /><circle cx="12" cy="12.5" r="2.6" /><path d="M6 12.5h.01M18 12.5h.01" /></svg>
  ),
  tag: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M3.5 12V4.5H11L20.5 14l-7.5 7.5z" /><circle cx="8" cy="9" r="1.3" /></svg>
  ),
  undo: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M8.5 5.5L4 10l4.5 4.5" /><path d="M4 10h9.5a6.5 6.5 0 0 1 0 13H9" /></svg>
  ),
  doc: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 16h6" /></svg>
  ),
  trash: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M4.5 6.5h15M9 6.5V4.5h6v2M7 6.5l1 13.5h8l1-13.5" /></svg>
  ),
  check: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M4.5 12.5l5 5L19.5 7" /></svg>
  ),
  download: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M12 4v11M7 11l5 5 5-5" /><path d="M4.5 20h15" /></svg>
  ),
  logout: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}><path d="M9 4H5.5v16H9" /><path d="M13 8l4 4-4 4M17 12H9.5" /></svg>
  ),
  info: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...P}>
      <circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5" /><circle cx="12" cy="8" r="0.4" fill="currentColor" />
    </svg>
  ),
  star: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 5.9L12 16.4 6.6 19.3l1.2-5.9L3.4 9.3l6-.7z" /></svg>
  ),
};

/* ---------------- Modal ---------------- */
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = "");
  }, []);
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 680 } : null} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">{Icon.x()}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Field with faint helper comment ---------------- */
export function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

/* ---------------- Address input with live US suggestions ---------------- */
export function AddressField({ label, hint, value, onPick }) {
  const [text, setText] = useState(value?.address || "");
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef();

  useEffect(() => { setText(value?.address || ""); }, [value?.address]);

  const onChange = (v) => {
    setText(v);
    onPick({ address: v, lat: null, lon: null, resolved: null, state: "" }); // typed but not resolved yet
    clearTimeout(timer.current);
    if (v.trim().length < 3) { setList([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await suggestAddresses(v);
        setList(res); setOpen(true);
      } catch { setList([]); }
    }, 450);
  };

  const pick = (s) => {
    setText(s.label);
    setOpen(false);
    onPick({ address: s.label, resolved: s.label, lat: s.lat, lon: s.lon, state: s.state });
  };

  return (
    <div className="field suggest">
      <label>{label}</label>
      <input
        value={text}
        placeholder="Street, city, state — e.g. 4500 S 4th Ave, Yakima, WA"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => list.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && list.length > 0 && (
        <div className="suggest-list">
          {list.map((s, i) => (
            <button key={i} type="button" onMouseDown={() => pick(s)}>{s.label}</button>
          ))}
        </div>
      )}
      <div className="hint">
        {value?.lat != null
          ? <span style={{ color: "var(--gold-3)", fontWeight: 600 }}>Location confirmed — miles will be exact.</span>
          : hint || "Type a normal US address and tap the correct match so miles come out right."}
      </div>
    </div>
  );
}

/* ---------------- Install prompt (Android banner + iPhone steps) ---------------- */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [showIOS, setShowIOS] = useState(false);
  // Deliberately not persisted anywhere: dismissing only hides it for this
  // visit. It comes back every time this component mounts again, i.e. every
  // time the landing page loads, until the app is actually installed.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (standalone) return;
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) setShowIOS(true);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (dismissed || (!deferred && !showIOS)) return null;
  const close = () => setDismissed(true);

  return (
    <div style={{ position: "fixed", left: 12, right: 12, bottom: "calc(70px + env(safe-area-inset-bottom))", zIndex: 55 }}>
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: "var(--gold-3)" }}>{Icon.download(24)}</span>
        <div style={{ flex: 1, fontSize: 13 }}>
          {deferred
            ? <b>Install Jamka LLC on this phone for the full app feel.</b>
            : <><b>Add to your iPhone:</b> tap the Share button in Safari, then <b>Add to Home Screen</b>.</>}
        </div>
        {deferred && (
          <button className="btn small" onClick={async () => { deferred.prompt(); await deferred.userChoice; close(); }}>
            Install
          </button>
        )}
        <button className="modal-close" onClick={close} aria-label="Dismiss">{Icon.x(16)}</button>
      </div>
    </div>
  );
}

/* ---------------- Site hints: quiet, dismissible tips ---------------- */
export function Hints({ storageKey, items }) {
  const [hidden, setHidden] = useState(() => localStorage.getItem(storageKey) === "1");
  if (hidden) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="between" style={{ marginBottom: 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ color: "var(--gold-3)" }}>{Icon.info(18)}</span>
          <b style={{ fontSize: 13.5 }}>A few pointers</b>
        </div>
        <button className="modal-close" aria-label="Dismiss hints"
          onClick={() => { localStorage.setItem(storageKey, "1"); setHidden(true); }}>
          {Icon.x(16)}
        </button>
      </div>
      <ul style={{ listStyle: "none", display: "grid", gap: 8 }}>
        {items.map((t, i) => (
          <li key={i} className="muted" style={{ fontSize: 13, lineHeight: 1.5, display: "flex", gap: 8 }}>
            <span style={{ color: "var(--gold-2)" }}>—</span>{t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Empty({ icon = "truck", text }) {
  return (
    <div className="empty-state">
      {Icon[icon](34)}
      <div>{text}</div>
    </div>
  );
}
