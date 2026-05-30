/* ============================================================
   CENTAUR — Product components (React, Babel-transpiled)
   Exposed on window for the app script.
   ============================================================ */

// shared signal helpers
function signalColor(v) {
  const t = Math.max(0, Math.min(100, v)) / 100;
  const hue = 68 + (152 - 68) * t;
  const l = 0.58 + 0.05 * t;
  return `oklch(${l} 0.118 ${hue})`;
}
function signalState(v) {
  if (v < 38) return 'OFFLOADING';
  if (v < 62) return 'MIXED';
  return 'ENHANCING';
}

// ---------- Big gauge (right rail) ----------
function SignalGauge({ value }) {
  const v = value == null ? 50 : value;
  const angle = -90 + (v / 100) * 180;
  const col = value == null ? 'var(--taupe)' : signalColor(v);
  return (
    <div className="cg-gauge">
      <svg viewBox="0 0 280 160" width="100%" aria-hidden="true">
        <path d="M 24 150 A 116 116 0 0 1 256 150" fill="none" stroke="var(--bone-2)" strokeWidth="18" strokeLinecap="round" />
        <path d="M 24 150 A 116 116 0 0 1 140 34" fill="none" stroke="var(--offload)" strokeWidth="18" strokeLinecap="round" opacity="0.85" />
        <path d="M 140 34 A 116 116 0 0 1 256 150" fill="none" stroke="var(--enhance)" strokeWidth="18" strokeLinecap="round" opacity="0.9" />
        <g style={{ transition: 'transform 0.7s var(--ease)', transformOrigin: '140px 150px', transform: `rotate(${angle}deg)` }}>
          <line x1="140" y1="150" x2="140" y2="48" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="140" cy="150" r="9" fill="var(--ink)" />
          <circle cx="140" cy="150" r="3.5" fill="var(--paper)" />
        </g>
      </svg>
      <div className="cg-read">
        <span className="cg-num" style={{ color: col }}>{value == null ? '—' : Math.round(v)}</span>
        <span className="cg-state" style={{ color: col }}>{value == null ? 'CALIBRATING' : signalState(v)}</span>
      </div>
      <div className="cg-foot">
        <span className="cg-leg"><span className="dot dot-offload"></span> Offloading</span>
        <span className="cg-leg">Enhancing <span className="dot dot-enhance"></span></span>
      </div>
    </div>
  );
}

// ---------- Sparkline of recent turns ----------
function Sparkline({ turns }) {
  if (!turns.length) {
    return <div className="cg-spark-empty mono">awaiting your first turn…</div>;
  }
  const max = 10;
  const recent = turns.slice(-max);
  return (
    <div className="cg-spark">
      {recent.map((t, i) => (
        <div key={i} className="cg-spark-col" title={`Turn signal: ${Math.round(t)}`}>
          <div className="cg-spark-bar" style={{ height: `${Math.max(8, t)}%`, background: signalColor(t) }}></div>
        </div>
      ))}
    </div>
  );
}

// ---------- Moves log ----------
const MOVE_META = {
  reframe:    { label: 'Prompt reframed', tone: 'off' },
  assumption: { label: 'Assumption surfaced', tone: 'enh' },
  challenge:  { label: 'Challenge raised', tone: 'enh' },
  reflection: { label: 'Reflected back', tone: 'enh' },
  probe:      { label: 'Probing question', tone: 'enh' },
  guardrail:  { label: 'Direct answer given', tone: 'off' },
};
function MovesLog({ moves }) {
  if (!moves.length) {
    return <p className="cg-empty">No moves yet. They'll appear here as the coach works.</p>;
  }
  return (
    <ul className="cg-moves">
      {moves.slice().reverse().map((m, i) => {
        const meta = MOVE_META[m.type] || { label: m.type, tone: 'enh' };
        return (
          <li key={moves.length - i} className="cg-move">
            <span className={`dot dot-${meta.tone === 'enh' ? 'enhance' : 'offload'}`}></span>
            <span className="cg-move-label">{meta.label}</span>
            <span className="cg-move-turn mono">T{m.turn}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Typing indicator ----------
function Typing() {
  return (
    <div className="cg-msg cg-msg-coach">
      <div className="cg-avatar cg-av-coach" aria-hidden="true"></div>
      <div className="cg-bubble cg-bubble-coach">
        <span className="cg-typing"><i></i><i></i><i></i></span>
      </div>
    </div>
  );
}

// ---------- Message ----------
function Message({ role, html, chips, score }) {
  const isCoach = role === 'coach';
  return (
    <div className={`cg-msg ${isCoach ? 'cg-msg-coach' : 'cg-msg-user'}`}>
      {isCoach && <div className="cg-avatar cg-av-coach" aria-hidden="true"></div>}
      <div className="cg-msg-col">
        <div className={`cg-bubble ${isCoach ? 'cg-bubble-coach' : 'cg-bubble-user'}`}
             dangerouslySetInnerHTML={{ __html: html }} />
        {chips && chips.length > 0 && (
          <div className="cg-chips">
            {!isCoach && score != null && (
              <span className={`chip ${score >= 60 ? 'chip-enhance' : score >= 40 ? 'chip-neutral' : 'chip-offload'}`}>
                <span className={`dot dot-${score >= 60 ? 'enhance' : 'offload'}`} style={{ opacity: score >= 40 && score < 60 ? 0.4 : 1 }}></span>
                {score >= 60 ? 'Enhancing' : score >= 40 ? 'Mixed' : 'Offloading'} · {Math.round(score)}
              </span>
            )}
            {isCoach && chips.map((c, i) => (
              <span key={i} className={`chip ${/reframe|detected|seeking|vague|yes\/no|direct/i.test(c) ? 'chip-offload' : 'chip-enhance'}`}>{c}</span>
            ))}
          </div>
        )}
      </div>
      {!isCoach && <div className="cg-avatar cg-av-user" aria-hidden="true">You</div>}
    </div>
  );
}

// ---------- Mode selector ----------
function ModeSelector({ mode, modes, onChange, disabled }) {
  const [open, setOpen] = React.useState(false);
  const current = modes.find((m) => m.id === mode);
  return (
    <div className="cg-mode">
      <button className="cg-mode-btn" onClick={() => !disabled && setOpen(!open)} disabled={disabled}>
        <span className="mono cg-mode-eye">MODE</span>
        <span className="cg-mode-label">{current.label}</span>
        <span className="cg-mode-caret">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="cg-mode-menu">
          {modes.map((m) => (
            <button key={m.id} className={`cg-mode-item ${m.id === mode ? 'is-active' : ''}`}
                    onClick={() => { onChange(m.id); setOpen(false); }}>
              <span className="cg-mode-item-label">{m.label}</span>
              <span className="cg-mode-item-blurb">{m.blurb}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  signalColor, signalState,
  SignalGauge, Sparkline, MovesLog, Typing, Message, ModeSelector,
});
