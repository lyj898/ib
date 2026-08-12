const SUBJECTS = [
  { id: "chinese", title: "高级华文", desc: "Advanced Chinese: writing technique, vocabulary, poetry" },
  { id: "chemistry", title: "Chemistry", desc: "Periodic table, reactivity, electrolysis, energy, organic chemistry" },
  { id: "physics", title: "Physics", desc: "Pressure, light, waves, electricity, magnetism, electromagnetism" },
  { id: "geography", title: "Geography", desc: "Weather & climate, climate change, hydrology, rivers, coasts" },
  { id: "history", title: "History", desc: "Cold War, Vietnam, Cuban Missile Crisis, social movements" },
  { id: "skills", title: "Exam Skills", desc: "History source analysis & Geography data-response technique" },
];

function qs(name) {
  return new URLSearchParams(location.search).get(name);
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

function initHeader(activeSubjectId) {
  const header = document.querySelector("header.site-header");
  if (!header) return;
  const wrap = document.createElement("div");
  wrap.className = "search-wrap";
  wrap.innerHTML = `
    <input id="global-search" type="search" placeholder="Search all notes, flashcards, quizzes…" autocomplete="off" />
    <div id="search-results"></div>
  `;
  header.appendChild(wrap);

  const input = wrap.querySelector("#global-search");
  const results = wrap.querySelector("#search-results");
  let dataPromise = null;
  let debounceTimer = null;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim().toLowerCase();
    if (query.length < 2) {
      results.classList.remove("open");
      results.innerHTML = "";
      return;
    }
    debounceTimer = setTimeout(async () => {
      if (!dataPromise) dataPromise = loadAllSubjectData();
      const all = await dataPromise;
      const matches = [];
      for (const s of SUBJECTS) {
        const data = all[s.id];
        if (!data) continue;
        for (const topic of data.topics) {
          const haystack = (
            topic.title + " " + stripHtml(topic.notesHtml || "")
          ).toLowerCase();
          if (haystack.includes(query)) {
            matches.push({ subject: s, topic });
          }
          if (matches.length >= 25) break;
        }
        if (matches.length >= 25) break;
      }
      if (!matches.length) {
        results.innerHTML = `<a href="#" style="cursor:default">No matches</a>`;
      } else {
        results.innerHTML = matches
          .map(
            (m) => `
          <a href="subject.html?s=${m.subject.id}&t=${encodeURIComponent(m.topic.id)}">
            ${escapeHtml(m.topic.title)}
            <small>${escapeHtml(m.subject.title)}</small>
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
