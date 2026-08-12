(async function () {
  const subjectId = qs("s") || "physics";
  const subjectMeta = SUBJECTS.find((s) => s.id === subjectId) || SUBJECTS[0];
  document.title = `${subjectMeta.title} — Year 4 Study Guide`;
  initHeader(subjectId, "notes");

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
    SRS.setLast(subjectId, topic.id, topic.title, subjectMeta.title);
    const topicIdx = data.topics.indexOf(topic);
    const prevTopic = data.topics[topicIdx - 1];
    const nextTopic = data.topics[topicIdx + 1];
    content.innerHTML = `
      <div class="subject-heading"><span class="subject-heading-icon">${subjectMeta.icon}</span><h1>${escapeHtml(subjectMeta.title)}</h1></div>
      <div class="layout" id="layout">
        <nav class="sidebar" id="topic-nav"></nav>
        <div>
          <div class="topic-panel">
            <h2>${escapeHtml(topic.title)}</h2>
            <div class="practice-buttons">
              <a class="btn primary" href="practice.html?s=${subjectId}&t=${encodeURIComponent(topic.id)}&m=flashcards">Flashcards</a>
              <a class="btn" href="practice.html?s=${subjectId}&t=${encodeURIComponent(topic.id)}&m=quiz">Quiz</a>
              <a class="btn" href="practice.html?s=${subjectId}&t=${encodeURIComponent(topic.id)}&m=short">Short Answer</a>
            </div>
            <div class="notes-body" id="notes-body">${topic.notesHtml || "<p><em>No notes yet.</em></p>"}</div>
            <div class="topic-nav-row">
              ${prevTopic ? `<a class="btn topic-step" data-id="${prevTopic.id}" href="subject.html?s=${subjectId}&t=${encodeURIComponent(prevTopic.id)}">← ${escapeHtml(prevTopic.title)}</a>` : `<span></span>`}
              ${nextTopic ? `<a class="btn topic-step" data-id="${nextTopic.id}" href="subject.html?s=${subjectId}&t=${encodeURIComponent(nextTopic.id)}">${escapeHtml(nextTopic.title)} →</a>` : ""}
            </div>
          </div>
        </div>
        <nav class="toc" id="toc"></nav>
      </div>
    `;

    // "On this page" mini-TOC with scrollspy (desktop only, needs enough headings)
    const notesBody = document.getElementById("notes-body");
    const heads = [...notesBody.querySelectorAll("h3")];
    if (heads.length >= 3) {
      heads.forEach((h, i) => (h.id = `sec-${i}`));
      const toc = document.getElementById("toc");
      toc.innerHTML =
        `<div class="toc-title">On this page</div>` +
        heads.map((h, i) => `<a href="#sec-${i}" data-sec="sec-${i}">${escapeHtml(h.textContent)}</a>`).join("");
      document.getElementById("layout").classList.add("has-toc");
      const links = new Map([...toc.querySelectorAll("a")].map((a) => [a.dataset.sec, a]));
      links.forEach((a) =>
        a.addEventListener("click", () => {
          links.forEach((l) => l.classList.remove("active"));
          a.classList.add("active");
        })
      );
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              links.forEach((l) => l.classList.remove("active"));
              const l = links.get(en.target.id);
              if (l) l.classList.add("active");
            }
          });
        },
        { rootMargin: "0px 0px -70% 0px" }
      );
      heads.forEach((h) => io.observe(h));
    }

    content.querySelectorAll(".topic-step").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        activeId = a.dataset.id;
        history.replaceState(null, "", `subject.html?s=${subjectId}&t=${encodeURIComponent(activeId)}`);
        render();
        window.scrollTo({ top: 0, behavior: "instant" });
      });
    });

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
    const activeLink = nav.querySelector("a.active");
    if (activeLink) activeLink.scrollIntoView({ block: "nearest", inline: "center" });

    content.querySelectorAll(".notes-body table").forEach((table) => {
      const wrap = document.createElement("div");
      wrap.className = "table-scroll";
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  render();
})();
