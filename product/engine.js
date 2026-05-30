/* ============================================================
   CENTAUR — Coach Engine
   A local heuristic that classifies a user turn as ENHANCING
   vs OFFLOADING, generates a Socratic response, and emits the
   "moves" the coach made. No network — deterministic demo brain.
   Exposes window.CentaurEngine.
   ============================================================ */
(function () {
  const lc = (s) => (s || '').toLowerCase().trim();

  // crude snippet extractor — echo the user's own words back
  function snippet(text, words = 7) {
    const clean = text.replace(/[?.!,]+$/g, '').trim();
    const parts = clean.split(/\s+/);
    let s = parts.slice(0, words).join(' ');
    if (parts.length > words) s += '…';
    return s;
  }
  function subject(text) {
    // grab object after "think about / launching / leaving" etc.
    const t = lc(text);
    const m = t.match(/(?:think about|thinking about|launch(?:ing)?|leav(?:e|ing)|start(?:ing)?|building|my)\s+(.{3,40})/);
    if (m) return m[1].replace(/[?.!,].*$/, '').trim();
    return 'this';
  }

  // ---------- classification ----------
  const OFFLOAD = {
    just_tell_me: [/just tell me/, /give me (the|your) answer/, /\bwhat should i do\b/, /tell me what to do/, /^(so )?what do you think i should/],
    yes_no:       [/^\s*(should|shall|do i|can i|would it|is it|are we|will it|does it make sense)\b/, /is (this|that|it) (a )?good idea/, /worth it\??$/, /\bgood idea\??\s*$/],
    validation:   [/right\?\s*$/, /\bmakes sense\??\s*$/, /\bis (this|that|it) (good|fine|ok|okay|right)\b/, /\bam i (right|wrong)\b/, /\bdo you agree\b/],
    solution:     [/\bhow (do|can|should) i\b/, /\bwhat'?s the best (way|approach)\b/, /\bbest way to\b/, /\bhow to make .* work\b/, /\bhow do i fix\b/],
    vague:        [/^i (want|need|'?d like) to think about/, /^(let'?s )?think about/, /^i'?ve been thinking about/, /^my (career|leadership|life|future|team|strategy)\b/],
  };

  const ENHANCE_MARKERS = [
    /\bbecause\b/, /\bthe reason\b/, /\bi assume\b/, /\bmy assumption\b/, /\bi'?m assuming\b/,
    /\bthe tension\b/, /\btrade.?off\b/, /\bon (the )?one hand\b/, /\bhowever\b/, /\bthe risk\b/,
    /\bevidence\b/, /\bi could be wrong\b/, /\bthe counter.?argument\b/, /\bwhat i'?m not sure\b/,
    /\bdepends on\b/, /\bif .* then\b/, /\bfails? (if|when|because)\b/,
  ];

  function classify(text, ctx) {
    const t = lc(text);
    const words = t.split(/\s+/).filter(Boolean).length;

    // explicit "just tell me" — guardrail, scored as offload but handled specially
    for (const re of OFFLOAD.just_tell_me) if (re.test(t)) return { kind: 'just_tell_me', score: 14 };

    // offload patterns
    for (const re of OFFLOAD.yes_no)     if (re.test(t)) return { kind: 'yes_no', score: 19 };
    for (const re of OFFLOAD.validation) if (re.test(t)) return { kind: 'validation', score: 22 };
    for (const re of OFFLOAD.solution)   if (re.test(t)) return { kind: 'solution', score: 31 };
    for (const re of OFFLOAD.vague)      if (re.test(t) && words < 16) return { kind: 'vague', score: 27 };

    // enhancing: count reasoning markers
    let markers = 0;
    for (const re of ENHANCE_MARKERS) if (re.test(t)) markers++;
    let score = 58;
    score += Math.min(markers, 4) * 8;        // reasoning markers
    if (words > 35) score += 6;               // sustained thinking
    if (words > 70) score += 5;
    if (words < 9 && markers === 0) score = 40; // terse, low-substance → mixed/low

    score = Math.max(8, Math.min(95, score));
    const kind = score >= 60 ? 'substantive' : (score >= 40 ? 'thin' : 'shallow');
    return { kind, score, markers };
  }

  // ---------- response banks ----------
  const REFRAMES = {
    yes_no: (text) => ({
      reply: `That's a yes/no question — and answering it won't actually help you think. Here's a harder version: <em>what would have to be true for the opposite choice to be the obviously right one?</em> That question gets at what you actually value, which is what you need before you can answer your own.`,
      moves: ['reframe'], chips: ['Yes/no detected', 'Reframed →'],
    }),
    validation: (text) => ({
      reply: `I notice that's looking for a verdict — and I don't think a verdict is what helps you here. A more productive question: <em>what's the scenario where this fails, and why haven't you ruled it out yet?</em> That's where your real thinking needs to happen.`,
      moves: ['reframe'], chips: ['Validation-seeking', 'Reframed →'],
    }),
    solution: (text) => ({
      reply: `You've jumped to tactics before we've pinned down the problem. Before <em>how</em> — what makes you confident this is the right thing to be solving at all? If that's shaky, the best approach to the wrong problem still loses.`,
      moves: ['reframe'], chips: ['Solution-seeking', 'Reframed →'],
    }),
    vague: (text) => ({
      reply: `That's a wide-open space — let me make it specific enough to be useful. Is there a recent, concrete moment where <em>${escapeHtml(subject(text))}</em> didn't go the way you intended? Starting from a real moment beats thinking about it in the abstract.`,
      moves: ['reframe'], chips: ['Vague topic', 'Reframed →'],
    }),
    just_tell_me: (text) => ({
      reply: `I can do that — briefly. Based on what you've shared, the stronger case is the one you've given more honest reasons for; the other side you've mostly assumed. But I'm working with thin context, and a verdict from me is worth less than one you've stress-tested. Want to keep pushing on it, or is that enough for now?`,
      moves: ['guardrail'], chips: ['Direct answer', 'Offered to resume'],
    }),
  };

  // mode-aware probing questions for substantive turns
  const PROBES = {
    open: [
      (t) => `You said <em>"${escapeHtml(snippet(t))}"</em> — what's the assumption underneath that you haven't examined yet?`,
      (t) => `It sounds like you're treating one thing there as settled. Is it a fact, or a belief you've inherited and never checked?`,
      (t) => `Say more about the <em>because</em>. What's the actual evidence behind it — and what would it take to change your mind?`,
      (t) => `What would the person who most disagrees with you say first? Steelman them for a moment.`,
      (t) => `Let me reflect that back: the real tension is between two things you both want. Which one are you quietly unwilling to give up?`,
    ],
    first_principles: [
      (t) => `Good. Now strip it down: what do you believe is fundamentally <em>true</em> here — and for each thing, is it fact or assumption?`,
      (t) => `How do you <em>know</em> that? Keep going until you hit something you can't reduce any further.`,
      (t) => `That still rests on an inherited assumption. What's underneath it?`,
      (t) => `Now reason forward: if only those bedrock truths are real, what follows that you hadn't considered?`,
    ],
    premortem: [
      (t) => `Imagine it's twelve months out and this has failed completely. What happened? Tell me the story.`,
      (t) => `That's one failure mode. Give me a second, genuinely different one — not a variation of the first.`,
      (t) => `For that failure: do you have a mitigation in mind, or are you hoping it won't happen?`,
      (t) => `Of the ways this dies, which one actually scares you — and why haven't you acted on it yet?`,
    ],
    devils_advocate: [
      (t) => `Let me take the other side, seriously: the strongest case against you is that you're optimizing for the wrong outcome entirely. How do you answer that?`,
      (t) => `Fair. But here's the next objection — your evidence is mostly things that confirm what you already wanted. What's the disconfirming data?`,
      (t) => `That's a real response, I'll grant it. Last one: if you're wrong, what's the first signal you'd see — and are you watching for it?`,
      (t) => `You've held up under three objections now. That's worth something. Where do you still feel the weakest?`,
    ],
  };

  const ACK = [
    `That's a real answer — not a comfortable one. Let's stay with it.`,
    `Good. You're doing the work here, not handing it to me.`,
    `Now we're somewhere worth being.`,
  ];

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------- main respond() ----------
  function respond(text, ctx) {
    const cls = classify(text, ctx);
    const mode = (ctx && ctx.mode) || 'open';
    let reply, moves = [], chips = [];

    if (REFRAMES[cls.kind]) {
      const r = REFRAMES[cls.kind](text);
      reply = r.reply; moves = r.moves; chips = r.chips;
    } else {
      // substantive / thin → a probing question, mode-aware
      const bank = PROBES[mode] || PROBES.open;
      const idx = (ctx && ctx.probeIndex || 0) % bank.length;
      const q = bank[idx](text);
      const lead = cls.kind === 'substantive' ? ACK[(ctx && ctx.ackIndex || 0) % ACK.length] + ' ' : '';
      reply = lead + q;
      // tag the move type
      if (/assum/i.test(q)) moves.push('assumption');
      else if (/disagree|other side|objection|steelman/i.test(q)) moves.push('challenge');
      else if (/reflect that back/i.test(q)) moves.push('reflection');
      else moves.push('probe');
      chips = cls.kind === 'substantive' ? ['Enhancing'] : ['Keep going'];
    }

    return {
      reply,
      turnScore: cls.score,
      kind: cls.kind,
      moves,
      chips,
      isReframe: !!REFRAMES[cls.kind] && cls.kind !== 'just_tell_me',
    };
  }

  // opening message per mode
  const OPENERS = {
    open: `What are you working through? Bring the actual tension — the thing you're genuinely unsure about — not the tidy version.`,
    first_principles: `<strong>First Principles.</strong> We'll break your problem down to what's irreducibly true, then build back up. Start by telling me what you believe is true about it.`,
    premortem: `<strong>Pre-Mortem.</strong> Describe the plan or decision in two or three sentences. Then we'll travel a year forward and find out how it failed.`,
    devils_advocate: `<strong>Devil's Advocate.</strong> State your position as clearly as you can. Then I'll argue the strongest possible case against it — not to win, but to find the weak points so you can shore them up.`,
  };

  const MODES = [
    { id: 'open', label: 'Open', blurb: 'Find the tension and start there.' },
    { id: 'first_principles', label: 'First Principles', blurb: 'Reduce to bedrock, reason back up.' },
    { id: 'premortem', label: 'Pre-Mortem', blurb: 'Assume it failed. Find out why.' },
    { id: 'devils_advocate', label: "Devil's Advocate", blurb: 'Argue the strongest case against you.' },
  ];

  window.CentaurEngine = { classify, respond, OPENERS, MODES, snippet };
})();
