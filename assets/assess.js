// Adaptive assessment: difficulty ladders up on correct answers and down on
// wrong ones, while topics you keep missing get weighted heavier in selection.
(function () {
  initHeader(null, null);
  initStudyKeys();
  const content = document.getElementById("content");

  const SESSION_LENGTH = 15;
  const LEVEL_NAMES = { 1: "Easy", 2: "Medium", 3: "Hard" };

  function loadAbility() {
    try {
      return JSON.parse(localStorage.getItem("sg2:ability") || "{}");
    } catch (e) {
      return {};
    }
  }
  function saveAbility(a) {
    try {
      localStorage.setItem("sg2:ability", JSON.stringify(a));
    } catch (e) { /* ignore */ }
  }

  function subjectTitleOf(sid) {
    const m = SUBJECTS.find((x) => x.id === sid);
    return m ? m.title : sid;
  }

  // ---------- setup screen ----------
  function setup() {
    const ability = loadAbility();
    content.innerHTML = `
      <h1>Adaptive assessment</h1>
      <p class="progress-text">${SESSION_LENGTH} questions that adjust to you: answer correctly and they get harder, slip up and they ease off — while topics you keep missing come back for more. Ends with a map of your weak spots.</p>
      <label style="display:block;margin:1.2rem 0 0.4rem;color:var(--text-muted);font-size:0.9rem;">
        Subject:
        <select id="assess-subject" style="margin-left:0.5rem;padding:0.35rem 0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text);">
          <option value="all">All subjects</option>
          ${SUBJECTS.map((s) => `<option value="${s.id}">${s.title}</option>`).join("")}
        </select>
      </label>
      <div class="dash-actions" style="margin-top:1rem;">
        <button class="btn primary" id="start-assess">Start assessment</button>
      </div>
      ${
        Object.keys(ability).length
          ? `<p class="progress-text" style="margin-top:1.2rem;">Your current level: ${Object.entries(ability)
              .map(([k, v]) => `${k === "all" ? "Overall" : escapeHtml(subjectTitleOf(k))} — ${LEVEL_NAMES[Math.round(v)]}`)
              .join(" · ")}</p>`
          : ""
      }
    `;
    document.getElementById("start-assess").addEventListener("click", async () => {
      const subject = document.getElementById("assess-subject").value;
      start(subject);
    });
  }

  // ---------- adaptive session ----------
  async function start(subjectId) {
    content.innerHTML = `<p class="empty-state">Preparing questions…</p>`;
    let all;
    if (subjectId === "all") all = await loadAllSubjectData();
    else all = { [subjectId]: await loadSubjectData(subjectId).catch(() => null) };

    const pool = [];
    for (const sid in all) {
      const d = all[sid];
      if (!d || !d.topics) continue;
      for (const topic of d.topics) {
        (topic.quiz || []).forEach((q, i) =>
          pool.push({ s: sid, t: topic.id, idx: i, topic, q, d: q.d || 2, used: false })
        );
      }
    }
    if (pool.length < SESSION_LENGTH) {
      content.innerHTML = `<p class="empty-state">Not enough questions for this subject.</p>`;
      return;
    }

    const ability = loadAbility();
    let a = typeof ability[subjectId] === "number" ? ability[subjectId] : 1.5;

    // topic weights: weak topics from stored quiz history start heavier
    const weights = {};
    SRS.weakTopics(10).forEach((w) => {
      weights[`${w.s}:${w.t}`] = 3;
    });
    const sessionStats = {}; // key -> {right, wrong, title, s, t}
    const answered = [];
    let qNum = 0;
    let responded = false;

    function topicWeight(key) {
      const st = sessionStats[key];
      let w = weights[key] || 1;
      if (st) w += 2 * st.wrong - 0.5 * st.right;
      return Math.max(0.25, w);
    }

    function pickNext() {
      const unused = pool.filter((p) => !p.used);
      if (!unused.length) return null;
      const L = Math.round(a);
      let candidates = unused.filter((p) => p.d === L);
      if (!candidates.length) candidates = unused.filter((p) => Math.abs(p.d - L) === 1);
      if (!candidates.length) candidates = unused;
      // weighted random over candidates by topic weight
      const total = candidates.reduce((n, p) => n + topicWeight(`${p.s}:${p.t}`), 0);
      let roll = Math.random() * total;
      for (const p of candidates) {
        roll -= topicWeight(`${p.s}:${p.t}`);
        if (roll <= 0) return p;
      }
      return candidates[candidates.length - 1];
    }

    function levelChip() {
      const L = Math.round(a);
      return `<span class="level-chip level-${L}">${LEVEL_NAMES[L]}</span>`;
    }

    function draw() {
      if (qNum >= SESSION_LENGTH) return results();
      const item = pickNext();
      if (!item) return results();
      item.used = true;
      const key = `${item.s}:${item.t}`;
      sessionStats[key] = sessionStats[key] || { right: 0, wrong: 0, title: item.topic.title, s: item.s, t: item.t };

      const pct = Math.round((qNum / SESSION_LENGTH) * 100);
      content.innerHTML = `
        <div class="progress-bar"><div style="width:${pct}%"></div></div>
        <div class="progress-text">Question ${qNum + 1} of ${SESSION_LENGTH} ${levelChip()}</div>
        <p class="card-source">${escapeHtml(subjectTitleOf(item.s))} · ${escapeHtml(item.topic.title)}</p>
        <div class="quiz-question">
          <h3>${escapeHtml(item.q.question)}</h3>
          <div id="choices"></div>
          <div id="explanation"></div>
          <button class="btn primary" id="next-q" style="display:none;">Next</button>
        </div>
        ${kbdHints("quiz")}
      `;
      const choicesEl = document.getElementById("choices");
      item.q.choices.forEach((choice, ci) => {
        const btn = document.createElement("button");
        btn.className = "choice";
        btn.textContent = choice;
        btn.addEventListener("click", () => {
          if (responded) return;
          responded = true;
          const correct = ci === item.q.answerIndex;
          const st = sessionStats[key];
          if (correct) {
            st.right++;
            a = Math.min(3, a + 0.35);
          } else {
            st.wrong++;
            a = Math.max(1, a - 0.45);
          }
          answered.push({ item, correct });
          SRS.recordQuiz(item.s, item.t, correct);
          if (correct) SRS.resolveMistake(item.s, item.t, item.idx, true);
          else SRS.addMistake(item.s, item.t, item.idx);
          [...choicesEl.children].forEach((el, k) => {
            el.disabled = true;
            if (k === item.q.answerIndex) el.classList.add("correct");
            else if (k === ci) el.classList.add("incorrect");
          });
          if (item.q.explanation) {
            document.getElementById("explanation").innerHTML = `<div class="explanation">${escapeHtml(item.q.explanation)}</div>`;
          }
          document.getElementById("next-q").style.display = "inline-block";
        });
        choicesEl.appendChild(btn);
      });
      document.getElementById("next-q").addEventListener("click", () => {
        qNum++;
        responded = false;
        draw();
      });
    }

    function results() {
      const ab = loadAbility();
      ab[subjectId] = Math.round(a * 100) / 100;
      saveAbility(ab);

      const score = answered.filter((x) => x.correct).length;
      const rows = Object.values(sessionStats)
        .filter((st) => st.right + st.wrong > 0)
        .sort((x, y) => x.right / (x.right + x.wrong) - y.right / (y.right + y.wrong));
      const weak = rows.filter((st) => st.right / (st.right + st.wrong) < 0.7);

      document.title = "Assessment Results — Year 4 Study Guide";
      content.innerHTML = `
        <div class="score-summary">
          <div class="big">${score} / ${answered.length}</div>
          <p>correct · you levelled ${a >= 2.5 ? "up to" : a >= 1.7 ? "around" : "down to"} <strong>${LEVEL_NAMES[Math.round(a)]}</strong></p>
        </div>
        ${
          weak.length
            ? `<h2>Focus here next</h2>
               <p class="progress-text">Topics you struggled with this session — drill them directly:</p>
               ${weak
                 .map(
                   (st) => `
                 <div class="review-item wrong">
                   <h3>${escapeHtml(st.title)}</h3>
                   <p class="card-source">${escapeHtml(subjectTitleOf(st.s))} · ${st.right} right, ${st.wrong} wrong this session</p>
                   <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                     <a class="btn primary" href="practice.html?s=${st.s}&t=${encodeURIComponent(st.t)}&m=quiz">Drill quiz</a>
                     <a class="btn" href="practice.html?s=${st.s}&t=${encodeURIComponent(st.t)}&m=flashcards">Flashcards</a>
                     <a class="btn" href="subject.html?s=${st.s}&t=${encodeURIComponent(st.t)}">Read notes</a>
                   </div>
                 </div>`
                 )
                 .join("")}`
            : `<p class="empty-state">No weak topics this session — nice work. Try again at a harder level.</p>`
        }
        ${
          rows.length
            ? `<h2>All topics this session</h2>
               <ul class="exam-history">${rows
                 .map((st) => {
                   const n = st.right + st.wrong;
                   return `<li><span>${escapeHtml(st.title)}</span><strong>${st.right}/${n}</strong></li>`;
                 })
                 .join("")}</ul>`
            : ""
        }
        <div style="display:flex;gap:0.6rem;flex-wrap:wrap;margin-top:1.5rem;">
          <a class="btn primary" href="assess.html">New assessment</a>
          <a class="btn" href="index.html">Back home</a>
        </div>
      `;
      window.scrollTo({ top: 0, behavior: "instant" });
    }

    document.title = "Assessment in progress — Year 4 Study Guide";
    draw();
  }

  setup();
})();
