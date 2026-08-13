// Subject hub: everything for one subject in one place — the guided Study
// Path on top, the self-service modes and materials à la carte below.
(function () {
  const subjectId = qs("s") || localStorage.getItem("sg2:pathSubject") || SUBJECTS[0].id;
  const meta = SUBJECTS.find((x) => x.id === subjectId) || SUBJECTS[0];
  initHeader(subjectId);
  const content = document.getElementById("content");
  document.title = `${meta.title} — Year 4 Study Guide`;
  try {
    localStorage.setItem("sg2:pathSubject", subjectId);
  } catch (e) { /* ignore */ }

  const dueBySubject = SRS.dueCountBySubject().counts[subjectId] || 0;
  const mistakes = SRS.mistakeList().filter((m) => m.s === subjectId).length;

  async function main() {
    let units = {};
    try {
      units = await fetch("data/units.json").then((r) => r.json());
    } catch (e) { /* ignore */ }
    const subjectUnits = units[subjectId] || [];
    const verified = subjectUnits.filter((u) => {
      const cp = SRS.getCheckpoint(subjectId, u.id);
      return cp && (cp.weak || []).length === 0;
    }).length;
    const pathPct = subjectUnits.length ? Math.round((verified / subjectUnits.length) * 100) : 0;

    const ALACARTE = [
      { href: `subject.html?s=${subjectId}`, icon: "📖", title: "Notes", desc: "Read the full study notes, topic by topic." },
      { href: `practice.html?s=${subjectId}&m=flashcards`, icon: "🃏", title: "Flashcards", desc: "Spaced-repetition cards — rated cards come back right before you'd forget them." },
      { href: `practice.html?s=${subjectId}&m=quiz`, icon: "❓", title: "Quiz", desc: "Multiple-choice per topic, with explanations for every answer." },
      { href: `practice.html?s=${subjectId}&m=short`, icon: "✍️", title: "Short Answer", desc: "Exam-style prompts with model answers and marking rubrics." },
      { href: `review.html?s=${subjectId}`, icon: "🔁", title: "Daily Mix", desc: "Due flashcards plus a short quiz aimed at your weak spots.", badge: dueBySubject ? `${dueBySubject} due` : "" },
      { href: `assess.html?s=${subjectId}`, icon: "🎚️", title: "Adaptive Test", desc: "Questions that get harder as you get them right — ends with a weak-spot map." },
      { href: `exam.html?s=${subjectId}`, icon: "📝", title: "Exam Mode", desc: "A timed mock paper, no feedback until you submit." },
      { href: `review.html?s=${subjectId}&m=mistakes`, icon: "🎯", title: "Mistakes", desc: "Re-drill the questions you got wrong until they're cleared.", badge: mistakes ? `${mistakes} open` : "" },
    ];

    content.innerHTML = `
      <div class="subject-heading">
        <span class="subject-heading-icon">${meta.icon}</span>
        <h1>${escapeHtml(meta.title)}</h1>
        <select id="hub-subject" style="margin-left:auto;padding:0.35rem 0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text);">
          ${SUBJECTS.map((s) => `<option value="${s.id}" ${s.id === subjectId ? "selected" : ""}>${s.title}</option>`).join("")}
        </select>
      </div>

      <h2 class="hub-section">Guided</h2>
      <a class="mode-card guided-card" href="path.html?s=${subjectId}">
        <span class="mode-icon">🧭</span>
        <h3>Study Path</h3>
        <p>The full journey in order: read each topic, practice it, take a unit checkpoint, retrain what you got wrong, then sit the exam.</p>
        <div class="progress-bar" style="margin-top:0.7rem;"><div style="width:${pathPct}%"></div></div>
        <p class="progress-text" style="margin:0.4rem 0 0;">${verified} / ${subjectUnits.length} units verified</p>
      </a>

      <h2 class="hub-section">Self-service</h2>
      <div class="mode-grid">
        ${ALACARTE.map(
          (m) => `
        <a class="mode-card" href="${m.href}">
          ${m.badge ? `<span class="due-badge">${m.badge}</span>` : ""}
          <span class="mode-icon">${m.icon}</span>
          <h3>${m.title}</h3>
          <p>${m.desc}</p>
        </a>`
        ).join("")}
      </div>
      <div id="weak-area"></div>
    `;

    document.getElementById("hub-subject").addEventListener("change", (e) => {
      location.href = `hub.html?s=${e.target.value}`;
    });

    // subject-scoped weak topics
    const weak = SRS.weakTopics(10).filter((w) => w.s === subjectId).slice(0, 3);
    if (weak.length) {
      try {
        const data = await loadSubjectData(subjectId);
        const chips = weak
          .map((w) => {
            const topic = data.topics.find((t) => t.id === w.t);
            if (!topic) return "";
            return `<a href="practice.html?s=${subjectId}&t=${encodeURIComponent(w.t)}&m=quiz">${escapeHtml(topic.title)} · ${Math.round(w.accuracy * 100)}%</a>`;
          })
          .filter(Boolean)
          .join("");
        if (chips) {
          document.getElementById("weak-area").innerHTML = `<p class="progress-text" style="margin:1.2rem 0 0.4rem;">Weakest topics — hit these again:</p><div class="weak-chips">${chips}</div>`;
        }
      } catch (e) { /* ignore */ }
    }
  }

  main();
})();
