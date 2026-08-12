// Daily mix (cross-subject due cards + weighted quiz round) and mistakes drill.
(function () {
  const mode = qs("m") || "mix";
  initHeader();
  const content = document.getElementById("content");

  function subjectTitle(s) {
    const m = SUBJECTS.find((x) => x.id === s);
    return m ? m.title : s;
  }
  function getTopic(all, s, t) {
    const d = all[s];
    return d && d.topics ? d.topics.find((x) => x.id === t) : null;
  }

  // MCQ runner shared by the mix quiz round and the mistakes drill.
  // items: [{s, t, idx, topic, q}]; onDone(score, total)
  function runQuizRound(body, items, headline, onDone) {
    let i = 0;
    let score = 0;
    let answered = false;

    function draw() {
      if (i >= items.length) return onDone(score, items.length);
      const item = items[i];
      const pct = Math.round((i / items.length) * 100);
      body.innerHTML = `
        <div class="progress-bar"><div style="width:${pct}%"></div></div>
        <div class="progress-text">${headline} · Question ${i + 1} of ${items.length} · Score: ${score}</div>
        <p class="card-source">${escapeHtml(subjectTitle(item.s))} · ${escapeHtml(item.topic.title)}</p>
        <div class="quiz-question">
          <h3>${escapeHtml(item.q.question)}</h3>
          <div id="choices"></div>
          <div id="explanation"></div>
          <button class="btn primary" id="next-q" style="display:none;">Next</button>
        </div>
      `;
      const choicesEl = body.querySelector("#choices");
      item.q.choices.forEach((choice, ci) => {
        const btn = document.createElement("button");
        btn.className = "choice";
        btn.textContent = choice;
        btn.addEventListener("click", () => {
          if (answered) return;
          answered = true;
          const correct = ci === item.q.answerIndex;
          if (correct) score++;
          SRS.recordQuiz(item.s, item.t, correct);
          if (correct) SRS.resolveMistake(item.s, item.t, item.idx, true);
          else SRS.addMistake(item.s, item.t, item.idx);
          [...choicesEl.children].forEach((el, k) => {
            el.disabled = true;
            if (k === item.q.answerIndex) el.classList.add("correct");
            else if (k === ci) el.classList.add("incorrect");
          });
          if (item.q.explanation) {
            body.querySelector("#explanation").innerHTML = `<div class="explanation">${escapeHtml(item.q.explanation)}</div>`;
          }
          body.querySelector("#next-q").style.display = "inline-block";
        });
        choicesEl.appendChild(btn);
      });
      body.querySelector("#next-q").addEventListener("click", () => {
        i++;
        answered = false;
        draw();
      });
    }

    draw();
  }

  // Sample up to n quiz questions: open mistakes first, then weak-topic questions, then random.
  function sampleQuiz(all, n) {
    const seen = new Set();
    const picks = [];
    for (const m of shuffle(SRS.mistakeList()).slice(0, 3)) {
      const topic = getTopic(all, m.s, m.t);
      const q = topic && topic.quiz ? topic.quiz[m.idx] : null;
      if (q) {
        picks.push({ s: m.s, t: m.t, idx: m.idx, topic, q });
        seen.add(`${m.s}:${m.t}:${m.idx}`);
      }
    }
    const weakKeys = new Set(SRS.weakTopics(5).map((w) => `${w.s}:${w.t}`));
    const pool = [];
    for (const sid in all) {
      const d = all[sid];
      if (!d || !d.topics) continue;
      for (const topic of d.topics) {
        (topic.quiz || []).forEach((q, i) => {
          const k = `${sid}:${topic.id}:${i}`;
          if (!seen.has(k)) pool.push({ s: sid, t: topic.id, idx: i, topic, q, weak: weakKeys.has(`${sid}:${topic.id}`) });
        });
      }
    }
    const shuffled = shuffle(pool);
    shuffled.sort((a, b) => (a.weak === b.weak ? 0 : a.weak ? -1 : 1));
    return picks.concat(shuffled.slice(0, Math.max(0, n - picks.length)));
  }

  // ---------- daily mix ----------
  function runMix(all) {
    const due = SRS.dueCards()
      .map((d) => {
        const topic = getTopic(all, d.s, d.t);
        const card = topic && topic.flashcards ? topic.flashcards[d.idx] : null;
        return card ? { ...d, topic, card } : null;
      })
      .filter(Boolean);
    const quizPicks = sampleQuiz(all, 8);

    document.title = "Daily Mix — Year 4 Study Guide";
    content.innerHTML = `
      <h1>Daily mix</h1>
      <p class="progress-text">${due.length} card${due.length === 1 ? "" : "s"} due · ${quizPicks.length} quiz questions</p>
      <div id="mix-body"></div>
    `;
    const body = document.getElementById("mix-body");
    let reviewed = 0;

    function cardsPhase() {
      if (!due.length) return quizPhase();
      const queue = due.slice();
      const total = queue.length;
      let flipped = false;

      function draw() {
        if (!queue.length) return quizPhase();
        const item = queue[0];
        const pct = Math.round((reviewed / total) * 100);
        const iv = SRS.previewIntervals(item.s, item.t, item.idx);
        body.innerHTML = `
          <div class="progress-bar"><div style="width:${pct}%"></div></div>
          <div class="progress-text">Cards · ${queue.length} to go</div>
          <div class="flashcard-wrap">
            <div class="flashcard" id="flip-card">
              <span class="label">${flipped ? "Answer" : "Question"}</span>
              <span class="card-context">${escapeHtml(subjectTitle(item.s))} · ${escapeHtml(item.topic.title)}</span>
              ${escapeHtml(flipped ? item.card.a : item.card.q)}
            </div>
          </div>
          ${
            flipped
              ? `<div class="rating-buttons">
                  <button class="rate rate-again" data-r="again">Again<small>now</small></button>
                  <button class="rate rate-hard" data-r="hard">Hard<small>${iv.hard}</small></button>
                  <button class="rate rate-good" data-r="good">Good<small>${iv.good}</small></button>
                  <button class="rate rate-easy" data-r="easy">Easy<small>${iv.easy}</small></button>
                </div>`
              : `<div class="deck-controls"><button class="btn primary" id="flip-btn" style="width:100%;">Show answer</button></div>`
          }
        `;
        body.querySelector("#flip-card").addEventListener("click", () => {
          flipped = !flipped;
          draw();
        });
        const flipBtn = body.querySelector("#flip-btn");
        if (flipBtn)
          flipBtn.addEventListener("click", () => {
            flipped = true;
            draw();
          });
        body.querySelectorAll(".rate").forEach((b) => {
          b.addEventListener("click", () => {
            const r = b.dataset.r;
            SRS.rate(item.s, item.t, item.idx, r);
            queue.shift();
            if (r === "again") queue.splice(Math.min(2, queue.length), 0, item);
            else reviewed++;
            flipped = false;
            draw();
          });
        });
      }

      draw();
    }

    function quizPhase() {
      if (!quizPicks.length) return summaryPhase(0, 0);
      runQuizRound(body, quizPicks, "Quiz round", summaryPhase);
    }

    function summaryPhase(score, totalQ) {
      const streak = SRS.streak();
      body.innerHTML = `
        <div class="score-summary">
          <div class="big">🔥 ${streak}</div>
          <p>day streak</p>
          <p>${reviewed} card${reviewed === 1 ? "" : "s"} reviewed${totalQ ? ` · quiz ${score} / ${totalQ}` : ""}</p>
          <div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;margin-top:1rem;">
            <a class="btn primary" href="index.html">Back home</a>
            <a class="btn" href="review.html">Another mix</a>
          </div>
        </div>
      `;
    }

    if (!due.length && !quizPicks.length) {
      body.innerHTML = `<p class="empty-state">Nothing to review yet — open a subject and start some flashcards first.</p>`;
      return;
    }
    cardsPhase();
  }

  // ---------- mistakes drill ----------
  function runMistakes(all) {
    document.title = "Mistakes — Year 4 Study Guide";
    const items = shuffle(SRS.mistakeList())
      .map((m) => {
        const topic = getTopic(all, m.s, m.t);
        const q = topic && topic.quiz ? topic.quiz[m.idx] : null;
        return q ? { ...m, topic, q } : null;
      })
      .filter(Boolean);

    content.innerHTML = `
      <h1>Mistakes drill</h1>
      <p class="progress-text">Questions you've gotten wrong — answer each correctly twice to clear it.</p>
      <div id="mix-body"></div>
    `;
    const body = document.getElementById("mix-body");

    if (!items.length) {
      body.innerHTML = `<p class="empty-state">No mistakes to review 🎉 Wrong quiz answers will collect here automatically.</p>`;
      return;
    }

    runQuizRound(body, items, "Mistakes", (score, total) => {
      const remaining = SRS.mistakeCount();
      body.innerHTML = `
        <div class="score-summary">
          <div class="big">${score} / ${total}</div>
          <p>correct this round · ${remaining} mistake${remaining === 1 ? "" : "s"} still open</p>
          <div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;margin-top:1rem;">
            ${remaining ? `<a class="btn primary" href="review.html?m=mistakes">Drill again</a>` : ""}
            <a class="btn" href="index.html">Back home</a>
          </div>
        </div>
      `;
    });
  }

  loadAllSubjectData().then((all) => {
    if (mode === "mistakes") runMistakes(all);
    else runMix(all);
  });
})();
