// Homepage dashboard: due cards, streak, mistakes, resume, weak topics, subject grid.
(function () {
  initHeader(null, "home");

  const dash = document.getElementById("dash");
  const grid = document.getElementById("subject-grid");

  const { counts, total } = SRS.dueCountBySubject();
  const streak = SRS.streak();
  const mistakes = SRS.mistakeCount();
  const last = SRS.getLast();
  const { tracked } = SRS.stats();
  const isNew = !total && !streak && !last && !tracked && !mistakes;

  if (isNew) {
    dash.innerHTML = `
      <div class="dash-actions">
        <a class="btn primary" href="review.html">▶ Try a daily mix</a>
        <a class="btn" href="exam.html">📝 Exam mode</a>
      </div>
      <p class="progress-text">New here? Pick a subject below — cards you review get scheduled and resurface right before you'd forget them.</p>
    `;
  } else {
    const stats = [];
    stats.push(
      `<a class="stat-card" href="review.html"><span class="stat-big">${total}</span><span class="stat-label">card${total === 1 ? "" : "s"} due today</span></a>`
    );
    stats.push(
      `<div class="stat-card"><span class="stat-big">${streak} 🔥</span><span class="stat-label">day streak${SRS.studiedToday() ? "" : " — study today to keep it"}</span></div>`
    );
    if (mistakes) {
      stats.push(
        `<a class="stat-card" href="review.html?m=mistakes"><span class="stat-big">${mistakes}</span><span class="stat-label">mistake${mistakes === 1 ? "" : "s"} to clear</span></a>`
      );
    }
    stats.push(
      `<div class="stat-card"><span class="stat-big">${tracked}</span><span class="stat-label">cards in rotation</span></div>`
    );

    dash.innerHTML = `
      <div class="stat-row">${stats.join("")}</div>
      <div class="dash-actions">
        <a class="btn primary" href="review.html">▶ Daily mix</a>
        <a class="btn" href="exam.html">📝 Exam mode</a>
        ${
          last
            ? `<a class="btn" href="subject.html?s=${last.s}&t=${encodeURIComponent(last.t)}">Continue: ${escapeHtml(last.title)}</a>`
            : ""
        }
      </div>
      <div id="weak-area"></div>
    `;
  }

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
  if (weak.length && !isNew) {
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
