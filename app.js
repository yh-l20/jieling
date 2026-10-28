(() => {
  "use strict";
  const films = window.jielingFilms || [];
  const byId = new Map(films.map(film => [film.id, film]));
  const dialog = document.getElementById("film-dialog");
  const player = document.getElementById("film-player");
  const chapters = document.getElementById("film-chapters");
  const switcher = document.getElementById("dialog-switcher");
  const error = document.getElementById("video-error");
  let activeId = null, returnFocus = null, generation = 0;
  function clock(seconds) {
    const total = Math.floor(seconds);
    return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
  }
  for (const film of films) {
    const duration = document.querySelector('[data-duration="' + film.id + '"]');
    if (duration) duration.textContent = clock(film.duration);
  }
  function tryPlay(token) {
    const promise = player.play();
    if (promise) promise.catch(reason => {
      if (token !== generation || reason.name === "AbortError" || reason.name === "NotAllowedError") return;
      error.hidden = false;
    });
  }
  function openFilm(id, trigger, autoplay = true) {
    const film = byId.get(id);
    if (!film) return;
    const token = ++generation;
    if (!dialog.open) returnFocus = trigger || document.activeElement;
    player.pause();
    error.hidden = true;
    activeId = id;
    document.getElementById("film-title").textContent = film.title;
    document.getElementById("film-category").textContent = film.category;
    const download = document.getElementById("download-film");
    download.href = film.src;
    download.download = film.filename;
    player.setAttribute("aria-label", film.title + "，中文配音与字幕");
    player.poster = film.poster;
    player.src = film.src;
    player.load();
    chapters.replaceChildren();
    for (const [index, chapter] of film.chapters.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = chapter.label;
      button.dataset.chapter = String(index);
      button.setAttribute("aria-label", chapter.label + "，从 " + clock(chapter.time) + " 开始");
      button.addEventListener("click", () => {
        const seek = () => {
          if (token !== generation) return;
          player.currentTime = Math.min(chapter.time, Number.isFinite(player.duration) ? player.duration : chapter.time);
          tryPlay(token);
        };
        if (player.readyState >= 1) seek();
        else player.addEventListener("loadedmetadata", seek, {once:true});
      });
      chapters.appendChild(button);
    }
    switcher.replaceChildren();
    for (const item of films) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.category;
      button.setAttribute("aria-pressed", String(item.id === id));
      button.addEventListener("click", () => openFilm(item.id, null, true));
      switcher.appendChild(button);
    }
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("modal-open");
    if (location.hash !== "#demo-" + id) history.replaceState(null, "", "#demo-" + id);
    if (autoplay) tryPlay(token);
  }
  document.querySelectorAll("[data-open-film]").forEach(button => {
    button.addEventListener("click", () => openFilm(button.dataset.openFilm, button));
  });
  function closeFilm() { player.pause(); dialog.close(); }
  document.getElementById("close-film").addEventListener("click", closeFilm);
  dialog.addEventListener("cancel", () => player.pause());
  dialog.addEventListener("click", event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) closeFilm();
  });
  dialog.addEventListener("close", () => {
    generation++;
    activeId = null;
    player.pause();
    player.removeAttribute("src");
    player.load();
    error.hidden = true;
    document.body.classList.remove("modal-open");
    if (location.hash.startsWith("#demo-")) history.replaceState(null, "", "#demos");
    if (returnFocus && returnFocus.isConnected) returnFocus.focus({preventScroll:true});
  });
  player.addEventListener("error", () => { if (activeId) error.hidden = false; });
  player.addEventListener("loadedmetadata", () => { error.hidden = true; });
  player.addEventListener("timeupdate", () => {
    const film = byId.get(activeId);
    if (!film) return;
    let current = 0;
    film.chapters.forEach((chapter, index) => {if (player.currentTime >= chapter.time) current = index;});
    chapters.querySelectorAll("button").forEach((button, index) => button.setAttribute("aria-current", String(index === current)));
  });
  document.getElementById("retry-film").addEventListener("click", () => {
    if (!activeId) return;
    error.hidden = true;
    player.load();
    tryPlay(generation);
  });
  const iconPaths = {
    file:'<path d="M7 3h9l4 4v14H7Z"/><path d="M16 3v5h4M10 12h7M10 16h7"/>',
    terminal:'<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m6 9 3 3-3 3M12 15h5"/>',
    globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    api:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
    database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    spark:'<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z"/>',
    tool:'<path d="M15 3a6 6 0 0 0-7 7L3 15a3 3 0 0 0 4 4l5-5a6 6 0 0 0 7-7l-4 4-4-4Z"/>',
    send:'<path d="m3 11 18-8-8 18-2-8Z"/><path d="m11 13 10-10"/>'
  };
  document.querySelectorAll("[data-icon]").forEach(node => {
    const shape = iconPaths[node.dataset.icon];
    if (shape) node.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + shape + "</svg>";
  });
  function syncLocation() {
    const match = location.hash.match(/^#demo-([a-z0-9-]+)$/);
    const id = match && (match[1] === "operations" ? "replenishment" : match[1]);
    if (id && byId.has(id)) {
      if (!dialog.open || activeId !== id) openFilm(id, null, false);
    } else if (dialog.open) closeFilm();
  }
  window.addEventListener("hashchange", syncLocation);
  window.addEventListener("popstate", syncLocation);
  syncLocation();
})();

