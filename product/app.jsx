/* ============================================================
   CENTAUR — Product app (React)
   Live coaching session with the cognitive signal.
   ============================================================ */
const { useState, useRef, useEffect, useCallback } = React;
const E = window.CentaurEngine;

const PROFILE = { domain: 'Strategy', goal: 'Reason without blind spots', style: 'Challenging' };

const STARTERS = [
  { text: 'Should I leave my job?', tone: 'off' },
  { text: 'I want to think about my leadership style.', tone: 'off' },
  { text: "I think we should sunset our legacy product. Retention is flat but maintenance is eating the roadmap — the tension is whether the remaining customers are the ones we can least afford to lose.", tone: 'enh' },
];

let MSG_ID = 0;

function App() {
  const [mode, setMode] = useState('open');
  const [messages, setMessages] = useState([]);
  const [moves, setMoves] = useState([]);
  const [turns, setTurns] = useState([]);
  const [signal, setSignal] = useState(null);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const [turnCount, setTurnCount] = useState(0);
  const [seconds, setSeconds] = useState(0);

  const probeIdx = useRef(0);
  const ackIdx = useRef(0);
  const threadRef = useRef(null);
  const taRef = useRef(null);

  // seed / reset opener when mode changes and no user turns yet
  useEffect(() => {
    const hasUser = messages.some((m) => m.role === 'user');
    if (!hasUser) {
      setMessages([{ id: ++MSG_ID, role: 'coach', html: E.OPENERS[mode], chips: null, score: null }]);
    } else {
      // mid-session mode switch: announce it
      setMessages((prev) => [...prev, { id: ++MSG_ID, role: 'coach', html: `<em>Switching to ${E.MODES.find((m) => m.id === mode).label}.</em> ${E.OPENERS[mode]}`, chips: null, score: null }]);
    }
  }, [mode]);

  // session timer
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // autoscroll
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const send = useCallback((raw) => {
    const text = (raw == null ? input : raw).trim();
    if (!text || typing) return;

    const res = E.respond(text, { mode, probeIndex: probeIdx.current, ackIndex: ackIdx.current });
    const tnum = turnCount + 1;

    // user message with its turn score
    setMessages((prev) => [...prev, { id: ++MSG_ID, role: 'user', html: escapeHtmlClient(text), chips: ['score'], score: res.turnScore }]);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
    setTurns((prev) => [...prev, res.turnScore]);
    setSignal((prev) => Math.round((prev == null ? 50 : prev) * 0.5 + res.turnScore * 0.5));
    setTurnCount(tnum);

    // advance variety counters
    if (res.kind === 'substantive') { probeIdx.current++; ackIdx.current++; }

    setTyping(true);
    const delay = 850 + Math.min(text.length * 7, 1100);
    setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [...prev, { id: ++MSG_ID, role: 'coach', html: res.reply, chips: res.chips, score: null }]);
      setMoves((prev) => [...prev, ...res.moves.map((type) => ({ type, turn: tnum }))]);
    }, delay);
  }, [input, typing, mode, turnCount]);

  const reframeCount = moves.filter((m) => m.type === 'reframe').length;
  const avg = turns.length ? Math.round(turns.reduce((a, b) => a + b, 0) / turns.length) : null;
  const hasUser = messages.some((m) => m.role === 'user');
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }
  function onInput(e) {
    setInput(e.target.value);
    const ta = e.target; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }

  return (
    <div className="cg-app">
      {/* ===== TOP BAR ===== */}
      <header className="cg-top">
        <div className="cg-top-left">
          <a href="index.html" className="cg-wordmark">
            <svg viewBox="0 0 32 32" fill="none" width="22" height="22" aria-hidden="true">
              <circle cx="16" cy="16" r="15" stroke="var(--ink)" strokeWidth="1.5" />
              <line x1="16" y1="16" x2="25" y2="9" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="16" cy="16" r="2.6" fill="var(--ink)" />
            </svg>
            Centaur
          </a>
          <span className="cg-divide"></span>
          <div className="cg-session-title">
            <span className="cg-session-name">Working session</span>
            <span className="cg-session-sub mono">{PROFILE.domain} · {PROFILE.goal}</span>
          </div>
        </div>
        <div className="cg-top-right">
          <ModeSelector mode={mode} modes={E.MODES} onChange={setMode} disabled={typing} />
          <span className="cg-timer mono"><span className="cg-rec"></span>{mm}:{ss}</span>
          <div className="cg-top-signal">
            <span className="cg-top-sig-num mono" style={{ color: signal == null ? 'var(--taupe)' : signalColor(signal) }}>{signal == null ? '—' : signal}</span>
            <span className="cg-top-sig-state mono" style={{ color: signal == null ? 'var(--taupe)' : signalColor(signal) }}>{signal == null ? 'CALIBRATING' : signalState(signal)}</span>
          </div>
        </div>
      </header>

      {/* ===== BODY ===== */}
      <div className="cg-body">
        {/* LEFT RAIL */}
        <aside className="cg-rail cg-rail-left">
          <div className="cg-card">
            <div className="cg-card-head mono">SESSION CONTEXT</div>
            <div className="cg-ctx-row"><span className="cg-ctx-k mono">DOMAIN</span><span className="cg-ctx-v">{PROFILE.domain}</span></div>
            <div className="cg-ctx-row"><span className="cg-ctx-k mono">GOAL</span><span className="cg-ctx-v">{PROFILE.goal}</span></div>
            <div className="cg-ctx-row"><span className="cg-ctx-k mono">STYLE</span><span className="cg-ctx-v">{PROFILE.style}</span></div>
          </div>
          <div className="cg-card cg-mode-blurb">
            <div className="cg-card-head mono">CURRENT MODE</div>
            <div className="cg-mode-name">{E.MODES.find((m) => m.id === mode).label}</div>
            <p className="cg-mode-desc">{E.MODES.find((m) => m.id === mode).blurb}</p>
          </div>
          <div className="cg-card cg-moves-card">
            <div className="cg-card-head mono">COACHING MOVES <span className="cg-count">{moves.length}</span></div>
            <MovesLog moves={moves} />
          </div>
        </aside>

        {/* CENTER THREAD */}
        <main className="cg-center">
          <div className="cg-thread" ref={threadRef}>
            <div className="cg-thread-inner">
              {messages.map((m) => (
                <Message key={m.id} role={m.role} html={m.html} chips={m.chips} score={m.score} />
              ))}
              {typing && <Typing />}
            </div>
          </div>

          <div className="cg-composer-wrap">
            {!hasUser && (
              <div className="cg-starters">
                <span className="cg-starters-label mono">TRY ONE — WATCH THE SIGNAL MOVE</span>
                <div className="cg-starter-chips">
                  {STARTERS.map((s, i) => (
                    <button key={i} className={`cg-starter ${s.tone === 'enh' ? 'is-enh' : 'is-off'}`} onClick={() => send(s.text)}>
                      <span className={`dot dot-${s.tone === 'enh' ? 'enhance' : 'offload'}`}></span>
                      <span className="cg-starter-txt">{s.text.length > 64 ? s.text.slice(0, 64) + '…' : s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="cg-composer">
              <textarea ref={taRef} className="cg-input" rows="1" placeholder="Bring the real tension — type, or pick a prompt above…"
                        value={input} onChange={onInput} onKeyDown={onKey} disabled={typing} />
              <button className="cg-send" onClick={() => send()} disabled={typing || !input.trim()} aria-label="Send">→</button>
            </div>
            <p className="cg-disclaimer mono">Centaur won't write it for you. It asks the question that makes you write a better one.</p>
          </div>
        </main>

        {/* RIGHT RAIL — THE SIGNAL */}
        <aside className="cg-rail cg-rail-right">
          <div className="cg-card cg-signal-card">
            <div className="cg-card-head mono">COGNITIVE SIGNAL <span className="cg-live"><span className="cg-live-dot"></span>LIVE</span></div>
            <SignalGauge value={signal} />
          </div>
          <div className="cg-card">
            <div className="cg-card-head mono">LAST 10 TURNS</div>
            <Sparkline turns={turns} />
          </div>
          <div className="cg-card cg-stats">
            <div className="cg-stat"><span className="cg-stat-num mono">{turnCount}</span><span className="cg-stat-lab">turns</span></div>
            <div className="cg-stat"><span className="cg-stat-num mono">{reframeCount}</span><span className="cg-stat-lab">reframes</span></div>
            <div className="cg-stat"><span className="cg-stat-num mono" style={{ color: avg == null ? 'var(--ink)' : signalColor(avg) }}>{avg == null ? '—' : avg}</span><span className="cg-stat-lab">avg signal</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function escapeHtmlClient(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
