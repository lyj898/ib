// Study Path: guided learn → practice → checkpoint → remediate → final exam
// flow per subject, layered over the existing engines. Soft guidance only —
// nothing is locked, the path just always knows your next step.
(function () {
  initHeader(null, "path");
  const content = document.getElementById("content");

  function subjectMetaOf(sid) {
    return SUBJECTS.find((x) => x.id === sid) || SUBJECTS[0];
  }

  async function main() {
    const subjectId = qs("s") || localStorage.getItem("sg2:pathSubject") || "physics";
    try {
      localStorage.setItem("sg2:pathSubject", subjectId);
    } catch (e) { /* ignore */ }
    const meta = subjectMetaOf(subjectId);
    applySubjectTheme(subjectId);
    document.title = `Study Path: ${meta.title} — Year 4 Study Guide`;

    let units, data;
    try {
      [units, data] = await Promise.all([
        fetch("data/units.json").then((r) => r.json()),
        loadSubjectData(subjectId),
      ]);
    } catch (e) {
      content.innerHTML = `<p class="empty-state">Couldn't load the study path.</p>`;
      return;
    }
    const subjectUnits = units[subjectId] || [];
    const topicMap = {};
    data.topics.forEach((t) => (topicMap[t.id] = t));

    // ---- per-unit status ----
    const unitViews = subjectUnits.map((u) => {
      const topics = u.topicIds.filter((t) => topicMap[t]);
      const learned = topics.filter((t) => SRS.isLearned(subjectId, t));
      const practiced = topics.filter((t) => SRS.isPracticed(subjectId, t));
      const cp = SRS.getCheckpoint(subjectId, u.id);
      const studied = learned.length === topics.length && practiced.length === topics.length;
      const verified = !!cp && (cp.weak || []).length === 0;
      let status, statusLabel;
      if (verified) {
        status = "verified";
        statusLabel = "✅ Verified";
      } else if (cp) {
        status = "needs-work";
        statusLabel = "🔁 Needs work";
      } else if (learned.length || practiced.length) {
        status = "in-progress";
        statusLabel = "📖 In progress";
      } else {
        status = "new";
        statusLabel = "Not started";
      }
      return { unit: u, topics, learned, practiced, cp, studied, verified, status, statusLabel };
    });

    // ---- next action across the path ----
    function nextAction() {
      for (const v of unitViews) {
        if (v.verified) continue;
        if (v.cp && (v.cp.weak || []).length) {
          const t = v.cp.weak[0];
          return { label: `Relearn: ${topicMap[t].title}`, href: `subject.html?s=${subjectId}&t=${encodeURIComponent(t)}`, sub: `${v.unit.title} — clear your weak topics, then retake the mini-check` };
        }
        const unread = v.topics.find((t) => !SRS.isLearned(subjectId, t));
        if (unread) {
          return { label: `Read: ${topicMap[unread].title}`, href: `subject.html?s=${subjectId}&t=${encodeURIComponent(unread)}`, sub: v.unit.title };
        }
        const unpracticed = v.topics.find((t) => !SRS.isPracticed(subjectId, t));
        if (unpracticed) {
          return { label: `Practice: ${topicMap[unpracticed].title}`, href: `practice.html?s=${subjectId}&t=${encodeURIComponent(unpracticed)}&m=flashcards`, sub: v.unit.title };
        }
        return { label: `Take checkpoint: ${v.unit.title}`, href: checkpointHref(v), sub: `${v.topics.length} topics studied — see how much stuck` };
      }
      return { label: "Final exam", href: `exam.html?s=${subjectId}`, sub: "All units verified — see where you stand" };
    }

    function checkpointHref(v, weakOnly) {
      const topics = weakOnly ? v.cp.weak : v.topics;
      return `assess.html?s=${subjectId}&unit=${encodeURIComponent(v.unit.id)}&topics=${encodeURIComponent(topics.join(","))}${weakOnly ? "&mini=1" : ""}`;
    }

    const verifiedCount = unitViews.filter((v) => v.verified).length;
    const readiness = subjectUnits.length ? Math.round((verifiedCount / subjectUnits.length) * 100) : 0;
    const next = nextAction();

    // last exam standing for this subject
    let lastExam = null;
    try {
      const hist = JSON.parse(localStorage.getItem("sg2:exams") || "[]");
      lastExam = hist.filter((e) => e.s === subjectId || e.subjectTitle === meta.title).pop() || null;
    } catch (e) { /* ignore */ }

    content.innerHTML = `
      <div class="subject-heading"><span class="subject-heading-icon">${meta.icon}</span><h1>Study Path</h1></div>
      <label style="display:block;margin:0 0 1.2rem;color:var(--text-muted);font-size:0.9rem;">
        Subject:
        <select id="path-subject" style="margin-left:0.5rem;padding:0.35rem 0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text);">
          ${SUBJECTS.map((s) => `<option value="${s.id}" ${s.id === subjectId ? "selected" : ""}>${s.title}</option>`).join("")}
        </select>
      </label>
      <a class="continue-banner" href="${next.href}">
        <span class="continue-kicker">Continue here</span>
        <strong>${escapeHtml(next.label)}</strong>
        <small>${escapeHtml(next.sub)}</small>
      </a>
      <div id="unit-list"></div>
      <div class="final-exam-block ${readiness === 100 ? "ready" : ""}">
        <h2>Final exam</h2>
        <p class="progress-text">Readiness: ${verifiedCount} / ${subjectUnits.length} units verified (${readiness}%)${readiness < 100 ? " — you can take it anytime, but clearing all checkpoints first gives a truer picture" : " — you're ready"}.</p>
        ${lastExam ? `<p class="progress-text">Last paper: ${lastExam.mcqScore}/${lastExam.mcqTotal} MCQ${lastExam.saTotal ? ` · SA ${lastExam.saScore}/${lastExam.saTotal}` : ""} (${lastExam.date})</p>` : ""}
        <a class="btn ${readiness === 100 ? "primary" : ""}" href="exam.html?s=${subjectId}">📝 Take the exam</a>
      </div>
    `;

    document.getElementById("path-subject").addEventListener("change", (e) => {
      location.href = `path.html?s=${e.target.value}`;
    });

    const list = document.getElementById("unit-list");
    list.innerHTML = unitViews
      .map((v, i) => {
        const topicRows = v.topics
          .map((t) => {
            const learned = SRS.isLearned(subjectId, t);
            const practiced = SRS.isPracticed(subjectId, t);
            const weak = v.cp && (v.cp.weak || []).includes(t);
            return `
            <li class="path-topic ${weak ? "weak" : ""}">
              <span class="path-topic-title">${weak ? "⚠️ " : ""}${escapeHtml(topicMap[t].title)}</span>
              <span class="path-topic-steps">
                <a href="subject.html?s=${subjectId}&t=${encodeURIComponent(t)}" class="${learned ? "done" : ""}" title="Notes">${learned ? "✓" : ""} Read</a>
                <a href="practice.html?s=${subjectId}&t=${encodeURIComponent(t)}&m=flashcards" class="${practiced ? "done" : ""}" title="Flashcards & quiz">${practiced ? "✓" : ""} Practice</a>
              </span>
            </li>`;
          })
          .join("");
        const weakList = v.cp ? (v.cp.weak || []) : [];
        return `
        <div class="unit-card status-${v.status}">
          <div class="unit-head">
            <h3>${i + 1}. ${escapeHtml(v.unit.title)}</h3>
            <span class="unit-status">${v.statusLabel}</span>
          </div>
          <p class="progress-text">Learn ${v.learned.length}/${v.topics.length} · Practice ${v.practiced.length}/${v.topics.length} · Checkpoint: ${v.cp ? `${v.cp.score}/${v.cp.total}` : "not taken"}</p>
          <div class="progress-bar"><div style="width:${Math.round(((v.learned.length + v.practiced.length) / (v.topics.length * 2)) * 100)}%"></div></div>
          <ul class="path-topics">${topicRows}</ul>
          ${
            weakList.length
              ? `<div class="remediation">
                  <strong>Retrain these before moving on:</strong>
                  <p class="progress-text" style="margin:0.3rem 0 0.6rem;">${weakList.map((t) => escapeHtml(topicMap[t].title)).join(" · ")}</p>
                  <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <a class="btn primary" href="${checkpointHref(v, true)}">Mini-check weak topics</a>
                    <a class="btn" href="practice.html?s=${subjectId}&t=${encodeURIComponent(weakList[0])}&m=quiz">Drill first weak topic</a>
                  </div>
                </div>`
              : ""
          }
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.8rem;">
            <a class="btn ${v.studied && !v.verified && !weakList.length ? "primary" : ""}" href="${checkpointHref(v)}">${v.cp ? "Retake checkpoint" : "Take checkpoint"}</a>
          </div>
        </div>`;
      })
      .join("");
  }

  main();
})();
