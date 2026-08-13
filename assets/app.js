const SUBJECTS = [
  { id: "chinese", title: "高级华文", desc: "Advanced Chinese: writing technique, vocabulary, poetry", icon: "🈶", color: "#e11d48" },
  { id: "chemistry", title: "Chemistry", desc: "Periodic table, reactivity, electrolysis, energy, organic chemistry", icon: "⚗️", color: "#059669" },
  { id: "physics", title: "Physics", desc: "Pressure, light, waves, electricity, magnetism, electromagnetism", icon: "⚛️", color: "#2563eb" },
  { id: "geography", title: "Geography", desc: "Weather & climate, rivers, coasts, globalisation, exam technique & case studies", icon: "🌍", color: "#0891b2" },
  { id: "history", title: "History", desc: "Cold War, Vietnam, Cuba, social movements, source-analysis skills", icon: "🏛️", color: "#b45309" },
];

function applySubjectTheme(subjectId) {
  const meta = SUBJECTS.find((s) => s.id === subjectId);
  if (meta) {
    document.documentElement.style.setProperty("--accent", meta.color);
    document.documentElement.style.setProperty("--subject-icon", `"${meta.icon}"`);
  }
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

async function loadSubjectData(subjectId) {
  const res = await fetch(`data/${subjectId}.json`);
  if (!res.ok) throw new Error(`Failed to load data for ${subjectId}`);
  return res.json();
}

async function loadAllSubjectData() {
  const all = {};
  await Promise.all(
    SUBJECTS.map(async (s) => {
      try {
        all[s.id] = await loadSubjectData(s.id);
      } catch (e) {
        all[s.id] = null;
      }
    })
  );
  return all;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || "";
}

// ---- Chinese-language card helpers ----
function hasChinese(str) {
  return /[一-鿿]/.test(str || "");
}

function speakChinese(str) {
  if (!("speechSynthesis" in window)) return;
  const parts = (str || "").match(/[一-鿿][一-鿿，。！？、；：]*/g) || [];
  if (!parts.length) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(parts.join("，"));
  u.lang = "zh-CN";
  u.rate = 0.85;
  const voice = speechSynthesis.getVoices().find((v) => v.lang && v.lang.startsWith("zh"));
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

// Escape a card face; optionally blur parenthesized pinyin (tap to reveal).
function renderCardFace(text, opts) {
  let html = escapeHtml(text);
  if (opts && opts.maskPinyin) {
    const wrap = (m, inner) =>
      /[a-zA-ZāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜĀÁĒÉĪÍŌÓŪÚ]/.test(inner)
        ? `(<span class="pinyin-mask" onclick="event.stopPropagation();this.classList.toggle('revealed')">${inner}</span>)`
        : m;
    html = html.replace(/\(([^)<]{1,60}?)\)/g, wrap);
    html = html.replace(/（([^）<]{1,60}?)）/g, wrap);
  }
  return html;
}

// ---- swipe gestures (touch/pen): drag a card sideways to rate it ----
function attachSwipe(el, opts) {
  const threshold = (opts && opts.threshold) || 60;
  let startX = null,
    startY = null,
    dx = 0,
    dragging = false;
  el.style.touchAction = "pan-y";
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    dragging = true;
  });
  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > Math.abs(dx) * 1.5) return;
    el.style.transform = `translateX(${dx}px) rotate(${dx / 40}deg)`;
    el.style.transition = "none";
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    el.style.transform = "";
    el.style.transition = "";
    if (Math.abs(dx) >= threshold) {
      el.dataset.swiped = "1";
      setTimeout(() => delete el.dataset.swiped, 400);
      if (dx > 0 && opts.onRight) opts.onRight();
      else if (dx < 0 && opts.onLeft) opts.onLeft();
    }
    dx = 0;
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", () => {
    dragging = false;
    dx = 0;
    el.style.transform = "";
    el.style.transition = "";
  });
}

// ---- keyboard shortcuts for study pages ----
// space/enter: flip card or advance; 1-4: rate card or pick quiz choice
function initStudyKeys() {
  if (window.__studyKeys) return;
  window.__studyKeys = true;
  document.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.key >= "1" && e.key <= "4") {
      const n = Number(e.key) - 1;
      const rates = document.querySelectorAll(".rate");
      if (rates.length) {
        if (rates[n]) rates[n].click();
        e.preventDefault();
        return;
      }
      const choices = document.querySelectorAll(".choice:not(:disabled)");
      if (choices.length) {
        if (choices[n]) choices[n].click();
        e.preventDefault();
      }
      return;
    }
    if (e.key === " " || e.key === "Enter") {
      const flipBtn = document.getElementById("flip-btn");
      if (flipBtn) {
        flipBtn.click();
        e.preventDefault();
        return;
      }
      const nextQ = document.getElementById("next-q");
      if (nextQ && nextQ.style.display !== "none") {
        nextQ.click();
        e.preventDefault();
        return;
      }
      const card = document.getElementById("flip-card");
      if (card) {
        card.click();
        e.preventDefault();
      }
    }
  });
}

// desktop keyboard-hint line (hidden on touch/small screens via CSS)
function kbdHints(type) {
  const hints = {
    flip: `Press <kbd>space</kbd> to show the answer`,
    rate: `<kbd>1</kbd> Again · <kbd>2</kbd> Hard · <kbd>3</kbd> Good · <kbd>4</kbd> Easy`,
    quiz: `<kbd>1</kbd>–<kbd>4</kbd> to answer · <kbd>space</kbd> for next`,
  };
  return `<p class="kbd-hints">${hints[type] || ""}</p>`;
}

// ---- bottom tab bar (mobile) ----
function initTabbar(active) {
  if (document.querySelector(".tabbar")) return;
  const last = typeof SRS !== "undefined" ? SRS.getLast() : null;
  const notesHref = last ? `subject.html?s=${last.s}&t=${encodeURIComponent(last.t)}` : "subject.html?s=physics";
  const mistakes = typeof SRS !== "undefined" ? SRS.mistakeCount() : 0;
  const bar = document.createElement("nav");
  bar.className = "tabbar";
  bar.innerHTML = `
    <a href="index.html" class="${active === "home" ? "active" : ""}"><span>🏠</span>Home</a>
    <a href="path.html" class="${active === "path" ? "active" : ""}"><span>🧭</span>Path</a>
    <a href="${notesHref}" class="${active === "notes" ? "active" : ""}"><span>📖</span>Notes</a>
    <a href="review.html" class="${active === "mix" ? "active" : ""}"><span>🔁</span>Mix</a>
    <a href="review.html?m=mistakes" class="${active === "mistakes" ? "active" : ""}"><span>🎯</span>Mistakes${mistakes ? `<b class="tab-badge">${mistakes}</b>` : ""}</a>
  `;
  document.body.appendChild(bar);
}

// ---- global search over the prebuilt index ----
let __searchIndex = null;
function loadSearchIndex() {
  if (!__searchIndex) {
    __searchIndex = fetch("data/search-index.json")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
  }
  return __searchIndex;
}

function searchSnippet(body, pos, qlen) {
  const start = Math.max(0, pos - 40);
  const end = Math.min(body.length, pos + qlen + 50);
  const before = escapeHtml((start > 0 ? "…" : "") + body.slice(start, pos));
  const match = escapeHtml(body.slice(pos, pos + qlen));
  const after = escapeHtml(body.slice(pos + qlen, end) + (end < body.length ? "…" : ""));
  return `${before}<mark>${match}</mark>${after}`;
}

function initHeader(activeSubjectId, activeTab) {
  if (activeSubjectId) applySubjectTheme(activeSubjectId);
  initTabbar(activeTab);
  const header = document.querySelector("header.site-header");
  if (!header) return;
  const wrap = document.createElement("div");
  wrap.className = "search-wrap";
  wrap.innerHTML = `
    <input id="global-search" type="search" placeholder="Search all notes, flashcards, quizzes…" autocomplete="off" />
    <span class="search-kbd">Ctrl K</span>
    <div id="search-results"></div>
  `;
  header.appendChild(wrap);

  const input = wrap.querySelector("#global-search");
  const results = wrap.querySelector("#search-results");
  let debounceTimer = null;

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim().toLowerCase();
    if (query.length < 2) {
      results.classList.remove("open");
      results.innerHTML = "";
      return;
    }
    debounceTimer = setTimeout(async () => {
      const index = await loadSearchIndex();
      const titleHits = [];
      const bodyHits = [];
      for (const entry of index) {
        const subject = SUBJECTS.find((s) => s.id === entry.s);
        if (!subject) continue;
        const titlePos = entry.title.toLowerCase().indexOf(query);
        if (titlePos >= 0) {
          titleHits.push({ entry, subject, snippet: null });
        } else {
          const bodyPos = entry.body.toLowerCase().indexOf(query);
          if (bodyPos >= 0) bodyHits.push({ entry, subject, snippet: searchSnippet(entry.body, bodyPos, query.length) });
        }
        if (titleHits.length >= 25) break;
      }
      const matches = titleHits.concat(bodyHits).slice(0, 25);
      if (!matches.length) {
        results.innerHTML = `<a href="#" style="cursor:default">No matches</a>`;
      } else {
        results.innerHTML = matches
          .map(
            (m) => `
          <a href="subject.html?s=${m.subject.id}&t=${encodeURIComponent(m.entry.t)}">
            <span class="result-icon">${m.subject.icon}</span>
            <span>${escapeHtml(m.entry.title)}
              ${m.snippet ? `<small class="result-snippet">${m.snippet}</small>` : ""}
              <small>${escapeHtml(m.subject.title)}</small>
            </span>
          </a>`
          )
          .join("");
      }
      results.classList.add("open");
    }, 150);
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) results.classList.remove("open");
  });
}
