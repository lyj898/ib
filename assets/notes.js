(async function () {
  const subjectId = qs("s") || "physics";
  const subjectMeta = SUBJECTS.find((s) => s.id === subjectId) || SUBJECTS[0];
  document.title = `${subjectMeta.title} — Year 4 Study Guide`;
  initHeader(subjectId);

  const content = document.getElementById("content");
  let data;
  try {
    data = await loadSubjectData(subjectId);
  } catch (e) {
    content.innerHTML = `<p class="empty-state">Couldn't load notes for this subject yet.</p>`;
    return;
  }

  if (!data.topics || !data.topics.length) {
    content.innerHTML = `<p class="empty-state">No topics yet for ${escapeHtml(subjectMeta.title)}.</p>`;
    return;
  }

  let activeId = qs("t") || data.topics[0].id;
  if (!data.topics.find((t) => t.id === activeId)) activeId = data.topics[0].id;

  function render() {
    const topic = data.topics.find((t) => t.id === activeId) || data.topics[0];
    content.innerHTML = `
      <h1>${escapeHtml(subjectMeta.title)}</h1>
      <div class="layout">
        <nav class="sidebar" id="topic-nav"></nav>
        <div>
          <div class="topic-panel">
            <h2>${escapeHtml(topic.title)}</h2>
            <div class="practice-buttons">
              <a class="btn primary" href="practice.html?s=${subjectId}&t=${encodeURIComponent(topic.id)}&m=flashcards">Flashcards</a>
              <a class="btn" href="practice.html?s=${subjectId}&t=${encodeURIComponent(topic.id)}&m=quiz">Quiz</a>
              <a class="btn" href="practice.html?s=${subjectId}&t=${encodeURIComponent(topic.id)}&m=short">Short Answer</a>
            </div>
            <div class="notes-body">${topic.notesHtml || "<p><em>No notes yet.</em></p>"}</div>
          </div>
        </div>
      </div>
    `;

    const nav = document.getElementById("topic-nav");
    nav.innerHTML = data.topics
      .map(
        (t) => `<a href="subject.html?s=${subjectId}&t=${encodeURIComponent(t.id)}"
          class="${t.id === activeId ? "active" : ""}"
          data-id="${t.id}">${escapeHtml(t.title)}</a>`
      )
      .join("");
    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        activeId = a.dataset.id;
        history.replaceState(null, "", `subject.html?s=${subjectId}&t=${encodeURIComponent(activeId)}`);
        render();
        window.scrollTo({ top: 0, behavior: "instant" });
      });
    });
  }

  render();
})();
