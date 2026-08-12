(function () {
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function lsKey(kind, subjectId, topicId) {
    return `sg:${kind}:${subjectId}:${topicId}`;
  }

  function getKnownSet(subjectId, topicId) {
    try {
      return new Set(JSON.parse(localStorage.getItem(lsKey("flash", subjectId, topicId)) || "[]"));
    } catch (e) {
      return new Set();
    }
  }

  function saveKnownSet(subjectId, topicId, set) {
    localStorage.setItem(lsKey("flash", subjectId, topicId), JSON.stringify([...set]));
  }

  function renderModeTabs(subjectId, topicId, mode) {
    const modes = [
      ["flashcards", "Flashcards"],
      ["quiz", "Quiz"],
      ["short", "Short Answer"],
    ];
    return `<div class="mode-tabs">${modes
      .map(
        ([id, label]) =>
          `<a class="${id === mode ? "active" : ""}" href="practice.html?s=${subjectId}&t=${encodeURIComponent(topicId)}&m=${id}">${label}</a>`
      )
      .join("")}</div>`;
  }

  function renderTopicPicker(subjectId, topics, activeId, mode) {
    const opts = topics
      .map(
        (t) =>
          `<option value="${t.id}" ${t.id === activeId ? "selected" : ""}>${escapeHtml(t.title)}</option>`
      )
      .join("");
    return `
      <label style="display:block;margin-bottom:1rem;color:var(--text-muted);font-size:0.9rem;">
        Topic:
        <select id="topic-picker" style="margin-left:0.5rem;padding:0.35rem 0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text);">
          ${opts}
        </select>
      </label>
    `;
  }

  function wireTopicPicker(subjectId, mode) {
    const picker = document.getElementById("topic-picker");
    if (!picker) return;
    picker.addEventListener("change", () => {
      location.href = `practice.html?s=${subjectId}&t=${encodeURIComponent(picker.value)}&m=${mode}`;
    });
  }

  function renderFlashcards(container, subjectId, topic) {
    const cards = topic.flashcards || [];
    if (!cards.length) {
      container.innerHTML += `<p class="empty-state">No flashcards yet for this topic.</p>`;
      return;
    }
    const known = getKnownSet(subjectId, topic.id);
    let deck = shuffle(cards.map((c, i) => ({ ...c, idx: i })).filter((c) => !known.has(c.idx)));
    let flipped = false;
    let reviewAll = false;

    const panel = document.createElement("div");
    container.appendChild(panel);

    function startDeck() {
      const known2 = getKnownSet(subjectId, topic.id);
      deck = shuffle(
        cards.map((c, i) => ({ ...c, idx: i })).filter((c) => reviewAll || !known2.has(c.idx))
      );
      flipped = false;
      draw();
    }

    function draw() {
      const known2 = getKnownSet(subjectId, topic.id);
      if (!deck.length) {
        panel.innerHTML = `
          <div class="score-summary">
            <div class="big">${known2.size} / ${cards.length}</div>
            <p>cards mastered</p>
            <label style="display:block;margin:1rem 0;"><input type="checkbox" id="review-all" ${reviewAll ? "checked" : ""}/> Review all cards (including mastered)</label>
            <button class="btn primary" id="restart-deck">Restart deck</button>
          </div>
        `;
        panel.querySelector("#review-all").addEventListener("change", (e) => {
          reviewAll = e.target.checked;
        });
        panel.querySelector("#restart-deck").addEventListener("click", startDeck);
        return;
      }
      const card = deck[0];
      const pct = Math.round((known2.size / cards.length) * 100);
      panel.innerHTML = `
        <div class="progress-bar"><div style="width:${pct}%"></div></div>
        <div class="progress-text">${deck.length} left this round · ${known2.size} / ${cards.length} mastered</div>
        <div class="flashcard-wrap">
          <div class="flashcard" id="flip-card"><span class="label">${flipped ? "Answer" : "Question"}</span>${escapeHtml(flipped ? card.a : card.q)}</div>
        </div>
        <div class="deck-controls">
          <button class="btn" id="still-learning">Still learning</button>
          <button class="btn" id="flip-btn">Flip card</button>
          <button class="btn primary" id="know-it">Know it</button>
        </div>
      `;
      panel.querySelector("#flip-card").addEventListener("click", () => {
        flipped = !flipped;
        draw();
      });
      panel.querySelector("#flip-btn").addEventListener("click", () => {
        flipped = !flipped;
        draw();
      });
      panel.querySelector("#still-learning").addEventListener("click", () => {
        const c = deck.shift();
        deck.push(c);
        flipped = false;
        draw();
      });
      panel.querySelector("#know-it").addEventListener("click", () => {
        const c = deck.shift();
        const k = getKnownSet(subjectId, topic.id);
        k.add(c.idx);
        saveKnownSet(subjectId, topic.id, k);
        flipped = false;
        draw();
      });
    }

    draw();
  }

  function renderQuiz(container, subjectId, topic) {
    const questions = topic.quiz || [];
    if (!questions.length) {
      container.innerHTML += `<p class="empty-state">No quiz yet for this topic.</p>`;
      return;
    }
    let order = shuffle(questions.map((q, i) => i));
    let idx = 0;
    let score = 0;
    let answered = false;

    const panel = document.createElement("div");
    container.appendChild(panel);

    function draw() {
      if (idx >= order.length) {
        panel.innerHTML = `
          <div class="score-summary">
            <div class="big">${score} / ${order.length}</div>
            <p>correct</p>
            <button class="btn primary" id="retry-quiz">Retry quiz</button>
          </div>
        `;
        panel.querySelector("#retry-quiz").addEventListener("click", () => {
          order = shuffle(questions.map((q, i) => i));
          idx = 0;
          score = 0;
          answered = false;
          draw();
        });
        return;
      }
      const q = questions[order[idx]];
      const pct = Math.round((idx / order.length) * 100);
      panel.innerHTML = `
        <div class="progress-bar"><div style="width:${pct}%"></div></div>
        <div class="progress-text">Question ${idx + 1} of ${order.length} · Score so far: ${score}</div>
        <div class="quiz-question">
          <h3>${escapeHtml(q.question)}</h3>
          <div id="choices"></div>
          <div id="explanation"></div>
          <button class="btn primary" id="next-q" style="display:none;">Next</button>
        </div>
      `;
      const choicesEl = panel.querySelector("#choices");
      q.choices.forEach((choice, ci) => {
        const btn = document.createElement("button");
        btn.className = "choice";
        btn.textContent = choice;
        btn.addEventListener("click", () => {
          if (answered) return;
          answered = true;
          const correct = ci === q.answerIndex;
          if (correct) score++;
          [...choicesEl.children].forEach((el, i) => {
            el.disabled = true;
            if (i === q.answerIndex) el.classList.add("correct");
            else if (i === ci) el.classList.add("incorrect");
          });
          if (q.explanation) {
            panel.querySelector("#explanation").innerHTML = `<div class="explanation">${escapeHtml(q.explanation)}</div>`;
          }
          panel.querySelector("#next-q").style.display = "inline-block";
        });
        choicesEl.appendChild(btn);
      });
      panel.querySelector("#next-q").addEventListener("click", () => {
        idx++;
        answered = false;
        draw();
      });
    }

    draw();
  }

  function renderShortAnswer(container, subjectId, topic) {
    const items = topic.shortAnswer || [];
    if (!items.length) {
      container.innerHTML += `<p class="empty-state">No short-answer prompts yet for this topic.</p>`;
      return;
    }
    let idx = 0;
    const panel = document.createElement("div");
    container.appendChild(panel);

    function draw() {
      if (idx >= items.length) {
        panel.innerHTML = `
          <div class="score-summary">
            <p>You've gone through all ${items.length} prompts for this topic.</p>
            <button class="btn primary" id="restart-sa">Start over</button>
          </div>
        `;
        panel.querySelector("#restart-sa").addEventListener("click", () => {
          idx = 0;
          draw();
        });
        return;
      }
      const item = items[idx];
      panel.innerHTML = `
        <div class="progress-text">Prompt ${idx + 1} of ${items.length}</div>
        <div class="short-answer">
          <h3>${escapeHtml(item.prompt)}</h3>
          <textarea placeholder="Write your answer here…"></textarea>
          <div style="margin-top:0.8rem;display:flex;gap:0.6rem;">
            <button class="btn primary" id="reveal-btn">Reveal model answer</button>
            <button class="btn" id="next-sa">Next</button>
          </div>
          <div id="rubric-area"></div>
        </div>
      `;
      panel.querySelector("#reveal-btn").addEventListener("click", () => {
        const rubricHtml = (item.rubric || []).map((r) => `<li>${escapeHtml(r)}</li>`).join("");
        panel.querySelector("#rubric-area").innerHTML = `
          <div class="rubric">
            <strong>Model answer</strong>
            <p>${escapeHtml(item.modelAnswer)}</p>
            ${rubricHtml ? `<strong>Rubric points</strong><ul>${rubricHtml}</ul>` : ""}
          </div>
        `;
      });
      panel.querySelector("#next-sa").addEventListener("click", () => {
        idx++;
        draw();
      });
    }

    draw();
  }

  async function main() {
    const subjectId = qs("s") || "physics";
    const mode = qs("m") || "flashcards";
    const subjectMeta = SUBJECTS.find((s) => s.id === subjectId) || SUBJECTS[0];
    initHeader(subjectId);

    const content = document.getElementById("content");
    let data;
    try {
      data = await loadSubjectData(subjectId);
    } catch (e) {
      content.innerHTML = `<p class="empty-state">Couldn't load practice content for this subject yet.</p>`;
      return;
    }
    if (!data.topics || !data.topics.length) {
      content.innerHTML = `<p class="empty-state">No topics yet for ${escapeHtml(subjectMeta.title)}.</p>`;
      return;
    }
    let topicId = qs("t") || data.topics[0].id;
    if (!data.topics.find((t) => t.id === topicId)) topicId = data.topics[0].id;
    const topic = data.topics.find((t) => t.id === topicId);

    document.title = `Practice: ${topic.title} — Year 4 Study Guide`;
    content.innerHTML = `
      <p><a href="subject.html?s=${subjectId}&t=${encodeURIComponent(topicId)}">&larr; Back to ${escapeHtml(subjectMeta.title)} notes</a></p>
      <h1>${escapeHtml(topic.title)}</h1>
      ${renderModeTabs(subjectId, topicId, mode)}
      ${renderTopicPicker(subjectId, data.topics, topicId, mode)}
      <div id="practice-body"></div>
    `;
    wireTopicPicker(subjectId, mode);

    const body = document.getElementById("practice-body");
    if (mode === "quiz") renderQuiz(body, subjectId, topic);
    else if (mode === "short") renderShortAnswer(body, subjectId, topic);
    else renderFlashcards(body, subjectId, topic);
  }

  main();
})();
