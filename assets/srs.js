// Spaced-repetition engine and study-progress storage (localStorage only).
// Card state: { iv: interval days, ease, due: "YYYY-MM-DD", reps, lapses }
const SRS = (() => {
  const DAY = 86400000;

  function dateOf(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function todayStr(offsetDays = 0) {
    return dateOf(Date.now() + offsetDays * DAY);
  }

  function load(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v === null || v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      /* storage full or private mode — degrade silently */
    }
  }

  // ---- card scheduling ----
  function cards() {
    return load("sg2:srs", {});
  }
  function cardKey(s, t, i) {
    return `${s}:${t}:${i}`;
  }
  // subject ids and topic ids are colon-free, so first/last colon split is safe
  function splitKey(k) {
    const a = k.indexOf(":");
    const b = k.lastIndexOf(":");
    return [k.slice(0, a), k.slice(a + 1, b), Number(k.slice(b + 1))];
  }

  function nextIntervals(c) {
    return {
      hard: c.iv < 1 ? 1 : Math.max(c.iv + 1, Math.round(c.iv * 1.2)),
      good: c.iv < 1 ? 1 : Math.round(c.iv * c.ease),
      easy: c.iv < 1 ? 3 : Math.round(c.iv * c.ease * 1.3),
    };
  }

  function rate(subject, topicId, idx, rating) {
    const all = cards();
    const k = cardKey(subject, topicId, idx);
    const c = all[k] || { iv: 0, ease: 2.5, reps: 0, lapses: 0, due: todayStr() };
    const nxt = nextIntervals(c);
    if (rating === "again") {
      if (c.reps > 0) c.lapses++;
      c.ease = Math.max(1.3, c.ease - 0.2);
      c.iv = 0;
      c.due = todayStr();
    } else if (rating === "hard") {
      c.ease = Math.max(1.3, c.ease - 0.15);
      c.iv = nxt.hard;
      c.due = todayStr(c.iv);
    } else if (rating === "easy") {
      c.ease += 0.15;
      c.iv = nxt.easy;
      c.due = todayStr(c.iv);
    } else {
      c.iv = nxt.good;
      c.due = todayStr(c.iv);
    }
    c.reps++;
    all[k] = c;
    save("sg2:srs", all);
    bumpActivity("reviews");
    return c;
  }

  function previewIntervals(subject, topicId, idx) {
    const c = cards()[cardKey(subject, topicId, idx)] || { iv: 0, ease: 2.5 };
    const nxt = nextIntervals(c);
    return { again: "now", hard: `${nxt.hard}d`, good: `${nxt.good}d`, easy: `${nxt.easy}d` };
  }

  // Split one topic's card indices into due / never-seen / scheduled-later.
  function splitTopic(subject, topicId, count) {
    const all = cards();
    const t = todayStr();
    const due = [], fresh = [], later = [];
    for (let i = 0; i < count; i++) {
      const c = all[cardKey(subject, topicId, i)];
      if (!c) fresh.push(i);
      else if (c.due <= t) due.push(i);
      else later.push(i);
    }
    return { due, fresh, later };
  }

  function dueCountBySubject() {
    const all = cards();
    const t = todayStr();
    const counts = {};
    let total = 0;
    for (const k in all) {
      if (all[k].due <= t) {
        const s = k.slice(0, k.indexOf(":"));
        counts[s] = (counts[s] || 0) + 1;
        total++;
      }
    }
    return { counts, total };
  }

  // All due cards across subjects, oldest due first: [{s, t, idx}]
  function dueCards() {
    const all = cards();
    const today = todayStr();
    const out = [];
    for (const k in all) {
      if (all[k].due <= today) {
        const [s, t, idx] = splitKey(k);
        out.push({ s, t, idx, due: all[k].due });
      }
    }
    out.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
    return out;
  }

  function stats() {
    const all = cards();
    let tracked = 0, mature = 0;
    for (const k in all) {
      tracked++;
      if (all[k].iv >= 21) mature++;
    }
    return { tracked, mature };
  }

  // ---- daily activity / streak ----
  function bumpActivity(kind) {
    const d = load("sg2:days", {});
    const t = todayStr();
    d[t] = d[t] || {};
    d[t][kind] = (d[t][kind] || 0) + 1;
    save("sg2:days", d);
  }
  function streak() {
    const d = load("sg2:days", {});
    let n = 0;
    let cursor = Date.now();
    if (!d[dateOf(cursor)]) cursor -= DAY; // yesterday's streak isn't broken yet
    while (d[dateOf(cursor)]) {
      n++;
      cursor -= DAY;
    }
    return n;
  }
  function studiedToday() {
    return !!load("sg2:days", {})[todayStr()];
  }
  // last n days of activity, oldest first: [{date, count}]
  function recentActivity(n = 14) {
    const d = load("sg2:days", {});
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const day = d[dateOf(Date.now() - i * DAY)] || {};
      let count = 0;
      for (const k in day) count += day[k];
      out.push({ date: dateOf(Date.now() - i * DAY), count });
    }
    return out;
  }

  // ---- quiz accuracy per topic ----
  function recordQuiz(subject, topicId, correct) {
    const q = load("sg2:quiz", {});
    const k = `${subject}:${topicId}`;
    q[k] = q[k] || { right: 0, wrong: 0 };
    q[k][correct ? "right" : "wrong"]++;
    save("sg2:quiz", q);
    bumpActivity("quiz");
  }
  function weakTopics(limit = 3) {
    const q = load("sg2:quiz", {});
    const rows = [];
    for (const k in q) {
      const { right, wrong } = q[k];
      const n = right + wrong;
      if (n >= 3 && wrong > 0) {
        const i = k.indexOf(":");
        rows.push({ s: k.slice(0, i), t: k.slice(i + 1), accuracy: right / n, attempts: n });
      }
    }
    rows.sort((a, b) => a.accuracy - b.accuracy);
    return rows.filter((r) => r.accuracy < 0.8).slice(0, limit);
  }

  // ---- mistakes deck: wrong quiz answers, cleared after 2 correct answers ----
  function addMistake(subject, topicId, qIdx) {
    const m = load("sg2:mistakes", {});
    m[`${subject}:${topicId}:${qIdx}`] = 0;
    save("sg2:mistakes", m);
  }
  function resolveMistake(subject, topicId, qIdx, correct) {
    const m = load("sg2:mistakes", {});
    const k = `${subject}:${topicId}:${qIdx}`;
    if (!(k in m)) return;
    if (!correct) m[k] = 0;
    else if (++m[k] >= 2) delete m[k];
    save("sg2:mistakes", m);
  }
  function mistakeList() {
    const m = load("sg2:mistakes", {});
    return Object.keys(m).map((k) => {
      const [s, t, idx] = splitKey(k);
      return { s, t, idx };
    });
  }
  function mistakeCount() {
    return Object.keys(load("sg2:mistakes", {})).length;
  }

  // ---- resume where you left off ----
  function setLast(s, t, title, subjectTitle) {
    save("sg2:last", { s, t, title, subjectTitle, when: Date.now() });
  }
  function getLast() {
    return load("sg2:last", null);
  }

  // ---- one-time migration from the old binary known/unknown flashcard keys ----
  function migrate() {
    if (localStorage.getItem("sg2:migrated")) return;
    const all = cards();
    const oldKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sg:flash:")) oldKeys.push(k);
    }
    for (const k of oldKeys) {
      const parts = k.split(":"); // sg, flash, subject, topicId
      const s = parts[2];
      const t = parts.slice(3).join(":");
      for (const idx of load(k, [])) {
        const ck = cardKey(s, t, idx);
        if (!all[ck]) {
          // previously "known" cards enter rotation as young cards due soon
          all[ck] = { iv: 3, ease: 2.5, reps: 1, lapses: 0, due: todayStr(1 + Math.floor(Math.random() * 3)) };
        }
      }
    }
    save("sg2:srs", all);
    try {
      localStorage.setItem("sg2:migrated", "1");
    } catch (e) { /* ignore */ }
  }
  migrate();

  return {
    todayStr,
    rate,
    previewIntervals,
    splitTopic,
    dueCountBySubject,
    dueCards,
    stats,
    streak,
    studiedToday,
    recentActivity,
    bumpActivity,
    recordQuiz,
    weakTopics,
    addMistake,
    resolveMistake,
    mistakeList,
    mistakeCount,
    setLast,
    getLast,
  };
})();
