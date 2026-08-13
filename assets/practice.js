(function () {
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

  // ---- flashcards with spaced repetition ----
  function renderFlashcards(container, subjectId, topic) {
    const cards = topic.flashcards || [];
    if (!cards.length) {
      container.innerHTML += `<p class="empty-state">No flashcards yet for this topic.</p>`;
      return;
    }
    const panel = document.createElement("div");
    container.appendChild(panel);

    const split = SRS.splitTopic(subjectId, topic.id, cards.length);
    let queue = shuffle(split.due).concat(shuffle(split.fresh));
    let sessionTotal = queue.length;
    let done = 0;
    let flipped = false;

    function startAll() {
      queue = shuffle(cards.map((_, i) => i));
      sessionTotal = queue.length;
      done = 0;
      flipped = false;
      draw();
    }

    function summary() {
      if (done > 0) SRS.markPracticed(subjectId, topic.id);
      const s = SRS.splitTopic(subjectId, topic.id, cards.length);
      const inRotation = cards.length - s.fresh.length;
      panel.innerHTML = `
        <div class="score-summary">
          <div class="big">${done}</div>
          <p>${done === 0 ? "All caught up — nothing due in this topic today." : `card${done === 1 ? "" : "s"} reviewed — nothing more due today.`}</p>
          <p class="progress-text">${inRotation} of ${cards.length} cards in rotation</p>
          <button class="btn primary" id="practice-all">Practice all ${cards.length} cards anyway</button>
        </div>`;
      panel.querySelector("#practice-all").addEventListener("click", startAll);
    }

    function draw() {
      if (!queue.length) return summary();
      const idx = queue[0];
      const card = cards[idx];
      const pct = Math.round((done / Math.max(sessionTotal, 1)) * 100);
      const iv = SRS.previewIntervals(subjectId, topic.id, idx);
      const faceText = flipped ? card.a : card.q;
      const isZh = subjectId === "chinese" && hasChinese(card.q + " " + card.a);
      const pinyinHidden = localStorage.getItem("sg2:pinyin") === "hide";
      const face = isZh ? renderCardFace(faceText, { maskPinyin: pinyinHidden }) : escapeHtml(faceText);
      panel.innerHTML = `
        <div class="progress-bar"><div style="width:${pct}%"></div></div>
        <div class="progress-text">${queue.length} to go · ${done} done
          ${isZh ? `<button class="pinyin-toggle" id="pinyin-toggle">拼音: ${pinyinHidden ? "hidden" : "shown"}</button>` : ""}
        </div>
        <div class="flashcard-wrap">
          <div class="flashcard" id="flip-card"><span class="label">${flipped ? "Answer" : "Question"}</span>${face}${isZh && hasChinese(faceText) ? `<button class="speak-btn" id="speak-btn" title="Listen">🔊</button>` : ""}</div>
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
        ${kbdHints(flipped ? "rate" : "flip")}
      `;
      const cardEl = panel.querySelector("#flip-card");
      cardEl.addEventListener("click", () => {
        if (cardEl.dataset.swiped) return;
        flipped = !flipped;
        draw();
      });
      const speakBtn = panel.querySelector("#speak-btn");
      if (speakBtn)
        speakBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          speakChinese(faceText);
        });
      const pinyinBtn = panel.querySelector("#pinyin-toggle");
      if (pinyinBtn)
        pinyinBtn.addEventListener("click", () => {
          localStorage.setItem("sg2:pinyin", pinyinHidden ? "show" : "hide");
          draw();
        });
      const flipBtn = panel.querySelector("#flip-btn");
      if (flipBtn)
        flipBtn.addEventListener("click", () => {
          flipped = true;
          draw();
        });
      function applyRating(r) {
        SRS.rate(subjectId, topic.id, idx, r);
        queue.shift();
        if (r === "again") queue.splice(Math.min(2, queue.length), 0, idx);
        else done++;
        flipped = false;
        draw();
      }
      if (flipped) {
        attachSwipe(cardEl, { onRight: () => applyRating("good"), onLeft: () => applyRating("again") });
      }
      panel.querySelectorAll(".rate").forEach((b) => {
        b.addEventListener("click", () => applyRating(b.dataset.r));
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
        SRS.markPracticed(subjectId, topic.id);
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
        ${kbdHints("quiz")}
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
          SRS.recordQuiz(subjectId, topic.id, correct);
          if (correct) SRS.resolveMistake(subjectId, topic.id, order[idx], true);
          else SRS.addMistake(subjectId, topic.id, order[idx]);
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
        SRS.bumpActivity("shortAnswer");
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
    initHeader(subjectId, "notes");
    initStudyKeys();

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
