// Homepage: streak + subject cards. Everything else lives in each subject's hub.
(function () {
  initHeader(null, "home");

  const dash = document.getElementById("dash");
  const grid = document.getElementById("subject-grid");

  const { counts } = SRS.dueCountBySubject();
  const streak = SRS.streak();

  if (streak > 0 || SRS.studiedToday()) {
    const act = SRS.recentActivity(14);
    const strip = `<span class="activity-strip">${act
      .map((a) => `<i class="${a.count ? (a.count >= 15 ? "l3" : a.count >= 5 ? "l2" : "l1") : ""}" title="${a.date}: ${a.count} reviews"></i>`)
      .join("")}</span>`;
    dash.innerHTML = `<div class="streak-bar"><span class="stat-big">${streak} 🔥</span><span class="stat-label">day streak${SRS.studiedToday() ? "" : " — study today to keep it"}</span>${strip}</div>`;
  } else {
    dash.innerHTML = `<p class="progress-text">Pick a subject — each one has a guided Study Path plus notes, flashcards, quizzes, and exams à la carte.</p>`;
  }

  grid.innerHTML = SUBJECTS.map((s) => {
    const due = counts[s.id] || 0;
    return `
    <a class="subject-card" href="hub.html?s=${s.id}" style="--card-accent: ${s.color}">
      ${due ? `<span class="due-badge">${due} due</span>` : ""}
      <span class="subject-icon">${s.icon}</span>
      <h3>${s.title}</h3>
      <p>${s.desc}</p>
      <span class="card-arrow">Open →</span>
    </a>`;
  }).join("");
})();
