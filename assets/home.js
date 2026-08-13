// Homepage: streak, the four study modes (with what-is-this descriptions), subject grid.
(function () {
  initHeader(null, "home");

  const dash = document.getElementById("dash");
  const grid = document.getElementById("subject-grid");

  const { counts } = SRS.dueCountBySubject();
  const streak = SRS.streak();

  const MODES = [
    {
      href: "path.html",
      icon: "🧭",
      title: "Study Path",
      desc: "The guided journey: read the notes, practice, take a checkpoint, retrain your weak topics, then sit the exam.",
    },
    {
      href: "review.html",
      icon: "🔁",
      title: "Daily Mix",
      desc: "Your daily 10 minutes: flashcards due today across all subjects, plus a short quiz aimed at your mistakes and weak spots.",
    },
    {
      href: "assess.html",
      icon: "🎚️",
      title: "Adaptive Test",
      desc: "15 questions that get harder as you get them right and easier when you slip — ends with a map of where you're weak.",
    },
    {
      href: "exam.html",
      icon: "📝",
      title: "Exam Mode",
      desc: "A timed mock paper with no feedback until you submit — the dress rehearsal that shows where you stand.",
    },
  ];

  const streakCard = streak > 0 || SRS.studiedToday()
    ? (() => {
        const act = SRS.recentActivity(14);
        const strip = `<span class="activity-strip">${act
          .map((a) => `<i class="${a.count ? (a.count >= 15 ? "l3" : a.count >= 5 ? "l2" : "l1") : ""}" title="${a.date}: ${a.count} reviews"></i>`)
          .join("")}</span>`;
        return `<div class="streak-bar"><span class="stat-big">${streak} 🔥</span><span class="stat-label">day streak${SRS.studiedToday() ? "" : " — study today to keep it"}</span>${strip}</div>`;
      })()
    : "";

  dash.innerHTML = `
    ${streakCard}
    <div class="mode-grid">
      ${MODES.map(
        (m) => `
      <a class="mode-card" href="${m.href}">
        <span class="mode-icon">${m.icon}</span>
        <h3>${m.title}</h3>
        <p>${m.desc}</p>
      </a>`
      ).join("")}
    </div>
    <div id="weak-area"></div>
  `;

  grid.innerHTML = SUBJECTS.map((s) => {
    const due = counts[s.id] || 0;
    return `
    <a class="subject-card" href="subject.html?s=${s.id}" style="--card-accent: ${s.color}">
      ${due ? `<span class="due-badge">${due} due</span>` : ""}
      <span class="subject-icon">${s.icon}</span>
      <h3>${s.title}</h3>
      <p>${s.desc}</p>
      <span class="card-arrow">Explore →</span>
    </a>`;
  }).join("");

  // Weak topics need titles, so resolve them after subject data loads.
  const weak = SRS.weakTopics(3);
  if (weak.length) {
    loadAllSubjectData().then((all) => {
      const chips = weak
        .map((w) => {
          const d = all[w.s];
          const topic = d && d.topics ? d.topics.find((t) => t.id === w.t) : null;
          if (!topic) return "";
          return `<a href="practice.html?s=${w.s}&t=${encodeURIComponent(w.t)}&m=quiz">${escapeHtml(topic.title)} · ${Math.round(w.accuracy * 100)}%</a>`;
        })
        .filter(Boolean)
        .join("");
      const area = document.getElementById("weak-area");
      if (chips && area) {
        area.innerHTML = `<p class="progress-text" style="margin:1rem 0 0.4rem;">Weakest topics — hit these again:</p><div class="weak-chips">${chips}</div>`;
      }
    });
  }
})();
