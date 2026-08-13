// Exam mode: timed mock papers sampled from the question banks, no feedback
// until submit, then a full review with short-answer self-marking.
(function () {
  initHeader(null, null);
  initStudyKeys();
  const content = document.getElementById("content");

  const PRESETS = [
    { id: "quick", label: "Quick", mcq: 10, sa: 0, minutes: 12 },
    { id: "standard", label: "Standard", mcq: 20, sa: 2, minutes: 40 },
    { id: "full", label: "Full paper", mcq: 30, sa: 4, minutes: 60 },
  ];

  function history() {
    try {
      return JSON.parse(localStorage.getItem("sg2:exams") || "[]");
    } catch (e) {
      return [];
    }
  }
  function saveHistory(h) {
    try {
      localStorage.setItem("sg2:exams", JSON.stringify(h));
    } catch (e) { /* ignore */ }
  }

  // ---------- setup screen ----------
  function setup() {
    document.title = "Exam Mode — Year 4 Study Guide";
    const past = history().slice(-5).reverse();
    content.innerHTML = `
      <h1>Exam mode</h1>
      <p class="progress-text">A timed paper with no feedback until you submit — just like the real thing. Wrong answers feed your mistakes deck.</p>
      <label style="display:block;margin:1.2rem 0 0.4rem;color:var(--text-muted);font-size:0.9rem;">
        Subject:
        <select id="exam-subject" style="margin-left:0.5rem;padding:0.35rem 0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text);">
          <option value="all">All subjects</option>
          ${SUBJECTS.map((s) => `<option value="${s.id}" ${qs("s") === s.id ? "selected" : ""}>${s.title}</option>`).join("")}
        </select>
      </label>
      <div class="preset-row">
        ${PRESETS.map(
          (p) => `
        <button class="preset" data-p="${p.id}">
          <strong>${p.label}</strong>
          <small>${p.mcq} MCQ${p.sa ? ` + ${p.sa} short answer` : ""} · ${p.minutes} min</small>
        </button>`
        ).join("")}
      </div>
      ${
        past.length
          ? `<h3 style="margin-top:2rem;">Recent papers</h3>
             <ul class="exam-history">${past
               .map(
                 (e) =>
                   `<li><span>${e.date} · ${escapeHtml(e.subjectTitle)} · ${e.preset}</span><strong>${e.mcqScore}/${e.mcqTotal}${e.saTotal ? ` · SA ${e.saScore}/${e.saTotal}` : ""}</strong></li>`
               )
               .join("")}</ul>`
          : ""
      }
    `;
    content.querySelectorAll(".preset").forEach((b) =>
      b.addEventListener("click", () => {
        const subject = document.getElementById("exam-subject").value;
        const preset = PRESETS.find((p) => p.id === b.dataset.p);
        start(subject, preset);
      })
    );
  }

  // ---------- exam runner ----------
  async function start(subjectId, preset) {
    content.innerHTML = `<p class="empty-state">Building your paper…</p>`;
    let all;
    if (subjectId === "all") {
      all = await loadAllSubjectData();
    } else {
      all = { [subjectId]: await loadSubjectData(subjectId).catch(() => null) };
    }
    const subjectTitle = subjectId === "all" ? "All subjects" : (SUBJECTS.find((s) => s.id === subjectId) || {}).title || subjectId;

    const mcqPool = [];
    const saPool = [];
    for (const sid in all) {
      const d = all[sid];
      if (!d || !d.topics) continue;
      for (const topic of d.topics) {
        (topic.quiz || []).forEach((q, i) => mcqPool.push({ s: sid, t: topic.id, idx: i, topic, q }));
        (topic.shortAnswer || []).forEach((item, i) => saPool.push({ s: sid, t: topic.id, idx: i, topic, item }));
      }
    }
    const mcqs = shuffle(mcqPool).slice(0, preset.mcq);
    const sas = shuffle(saPool).slice(0, preset.sa);
    if (!mcqs.length) {
      content.innerHTML = `<p class="empty-state">No questions available for this subject.</p>`;
      return;
    }

    const answers = new Array(mcqs.length).fill(null);
    const saTexts = new Array(sas.length).fill("");
    const totalItems = mcqs.length + sas.length;
    let current = 0;
    const deadline = Date.now() + preset.minutes * 60000;

    const guard = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    document.body.classList.add("exam-running");

    const tick = setInterval(() => {
      const el = document.getElementById("exam-timer");
      if (!el) return;
      const left = deadline - Date.now();
      if (left <= 0) {
        submit(true);
        return;
      }
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      el.textContent = `${m}:${String(s).padStart(2, "0")}`;
      el.classList.toggle("low", left < 60000);
    }, 500);

    function answeredCount() {
      return answers.filter((a) => a !== null).length + saTexts.filter((t) => t.trim()).length;
    }

    function paletteHtml() {
      const dots = [];
      for (let i = 0; i < mcqs.length; i++) {
        dots.push(
          `<button data-i="${i}" class="${answers[i] !== null ? "answered" : ""} ${i === current ? "current" : ""}">${i + 1}</button>`
        );
      }
      for (let j = 0; j < sas.length; j++) {
        const i = mcqs.length + j;
        dots.push(
          `<button data-i="${i}" class="${saTexts[j].trim() ? "answered" : ""} ${i === current ? "current" : ""}">S${j + 1}</button>`
        );
      }
      return `<div class="palette">${dots.join("")}</div>`;
    }

    function renderItem() {
      const isSA = current >= mcqs.length;
      const header = `
        <div class="exam-bar">
          <span id="exam-timer">…</span>
          <span class="progress-text" style="margin:0;">${answeredCount()} / ${totalItems} answered</span>
          <button class="btn primary" id="submit-exam">Submit</button>
        </div>
        ${paletteHtml()}
      `;
      if (!isSA) {
        const m = mcqs[current];
        content.innerHTML = `
          ${header}
          <p class="card-source">${escapeHtml(subjectTitleOf(m.s))} · ${escapeHtml(m.topic.title)}</p>
          <div class="quiz-question">
            <h3>Q${current + 1}. ${escapeHtml(m.q.question)}</h3>
            <div id="choices">
              ${m.q.choices
                .map(
                  (c, ci) =>
                    `<button class="choice ${answers[current] === ci ? "selected" : ""}" data-ci="${ci}">${escapeHtml(c)}</button>`
                )
                .join("")}
            </div>
          </div>
          ${navHtml()}
        `;
        content.querySelectorAll(".choice").forEach((b) =>
          b.addEventListener("click", () => {
            answers[current] = Number(b.dataset.ci);
            renderItem();
          })
        );
      } else {
        const j = current - mcqs.length;
        const sa = sas[j];
        content.innerHTML = `
          ${header}
          <p class="card-source">${escapeHtml(subjectTitleOf(sa.s))} · ${escapeHtml(sa.topic.title)}</p>
          <div class="short-answer">
            <h3>S${j + 1}. ${escapeHtml(sa.item.prompt)}</h3>
            <textarea id="sa-text" placeholder="Write your answer here…">${escapeHtml(saTexts[j])}</textarea>
          </div>
          ${navHtml()}
        `;
        content.querySelector("#sa-text").addEventListener("input", (e) => {
          saTexts[j] = e.target.value;
        });
      }
      content.querySelectorAll(".palette button").forEach((b) =>
        b.addEventListener("click", () => {
          current = Number(b.dataset.i);
          renderItem();
        })
      );
      const prev = content.querySelector("#nav-prev");
      const next = content.querySelector("#nav-next");
      if (prev)
        prev.addEventListener("click", () => {
          current = Math.max(0, current - 1);
          renderItem();
        });
      if (next)
        next.addEventListener("click", () => {
          current = Math.min(totalItems - 1, current + 1);
          renderItem();
        });
      content.querySelector("#submit-exam").addEventListener("click", () => submit(false));
    }

    function navHtml() {
      return `
        <div class="deck-controls" style="margin-top:1rem;">
          <button class="btn" id="nav-prev" ${current === 0 ? "disabled" : ""}>← Previous</button>
          <button class="btn" id="nav-next" ${current === totalItems - 1 ? "disabled" : ""}>Next →</button>
        </div>
      `;
    }

    function subjectTitleOf(sid) {
      const m = SUBJECTS.find((x) => x.id === sid);
      return m ? m.title : sid;
    }

    function submit(auto) {
      if (!auto) {
        const unanswered = totalItems - answeredCount();
        if (unanswered > 0 && !confirm(`${unanswered} item${unanswered === 1 ? "" : "s"} unanswered — submit anyway?`)) return;
      }
      clearInterval(tick);
      window.removeEventListener("beforeunload", guard);

      let score = 0;
      mcqs.forEach((m, i) => {
        const correct = answers[i] === m.q.answerIndex;
        if (correct) score++;
        SRS.recordQuiz(m.s, m.t, correct);
        if (correct) SRS.resolveMistake(m.s, m.t, m.idx, true);
        else SRS.addMistake(m.s, m.t, m.idx);
      });

      const saRubricTotal = sas.reduce((n, sa) => n + (sa.item.rubric || []).length, 0);
      const entry = {
        date: SRS.todayStr(),
        s: subjectId,
        subjectTitle,
        preset: preset.label,
        mcqScore: score,
        mcqTotal: mcqs.length,
        saScore: 0,
        saTotal: saRubricTotal,
      };
      const h = history();
      h.push(entry);
      saveHistory(h);

      results(score, entry, h);
    }

    function results(score, entry, h) {
      document.body.classList.remove("exam-running");
      document.title = "Exam Results — Year 4 Study Guide";
      const pct = Math.round((score / mcqs.length) * 100);
      content.innerHTML = `
        <div class="score-summary">
          <div class="big">${score} / ${mcqs.length}</div>
          <p>${pct}% on multiple choice${auto_label()}</p>
        </div>
        ${
          sas.length
            ? `<h2>Short answers — mark yourself</h2>
               <p class="progress-text">Tick each rubric point your answer covered. <span id="sa-score">SA score: 0 / ${entry.saTotal}</span></p>
               ${sas
                 .map(
                   (sa, j) => `
                 <div class="review-item">
                   <p class="card-source">${escapeHtml(subjectTitleOf(sa.s))} · ${escapeHtml(sa.topic.title)}</p>
                   <h3>S${j + 1}. ${escapeHtml(sa.item.prompt)}</h3>
                   <p><strong>Your answer:</strong> ${saTexts[j].trim() ? escapeHtml(saTexts[j]) : "<em>(blank)</em>"}</p>
                   <div class="rubric">
                     <strong>Model answer</strong>
                     <p>${escapeHtml(sa.item.modelAnswer)}</p>
                     <strong>Rubric — tick what you covered</strong>
                     ${(sa.item.rubric || [])
                       .map(
                         (r, ri) => `
                       <label class="rubric-check"><input type="checkbox" class="sa-check" /> <span>${escapeHtml(r)}</span></label>`
                       )
                       .join("")}
                   </div>
                 </div>`
                 )
                 .join("")}`
            : ""
        }
        <h2>Multiple choice review</h2>
        ${mcqs
          .map((m, i) => {
            const right = answers[i] === m.q.answerIndex;
            return `
            <div class="review-item ${right ? "right" : "wrong"}">
              <p class="card-source">${escapeHtml(subjectTitleOf(m.s))} · ${escapeHtml(m.topic.title)}</p>
              <h3>Q${i + 1}. ${escapeHtml(m.q.question)}</h3>
              <p><strong>Your answer:</strong> ${answers[i] !== null ? escapeHtml(m.q.choices[answers[i]]) : "<em>(blank)</em>"} ${right ? "✅" : "❌"}</p>
              ${!right ? `<p><strong>Correct:</strong> ${escapeHtml(m.q.choices[m.q.answerIndex])}</p>` : ""}
              ${m.q.explanation ? `<div class="explanation">${escapeHtml(m.q.explanation)}</div>` : ""}
            </div>`;
          })
          .join("")}
        <div style="display:flex;gap:0.6rem;flex-wrap:wrap;margin-top:1.5rem;">
          <a class="btn primary" href="exam.html">Another paper</a>
          <a class="btn" href="index.html">Back home</a>
        </div>
      `;
      const checks = content.querySelectorAll(".sa-check");
      checks.forEach((c) =>
        c.addEventListener("change", () => {
          const n = [...checks].filter((x) => x.checked).length;
          entry.saScore = n;
          saveHistory(h);
          const el = document.getElementById("sa-score");
          if (el) el.textContent = `SA score: ${n} / ${entry.saTotal}`;
        })
      );
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    function auto_label() {
      return deadline - Date.now() <= 0 ? " (time ran out)" : "";
    }

    document.title = "Exam in progress — Year 4 Study Guide";
    renderItem();
  }

  setup();
})();
