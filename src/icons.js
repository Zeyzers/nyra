(function (root) {
  const ICONS = {
    "arrow-left": '<path d="M15 6l-6 6 6 6"/><path d="M9 12h12"/>',
    "arrow-right": '<path d="M9 6l6 6-6 6"/><path d="M3 12h12"/>',
    bookmark: '<path d="M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5z"/>',
    "bookmark-filled": '<path fill="currentColor" d="M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    extensions: '<path d="M9 3h6v4h2.5a2.5 2.5 0 0 1 0 5H15v6H9v-6H6.5a2.5 2.5 0 0 1 0-5H9V3z"/>',
    gear: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="m4.93 4.93 2.12 2.12"/><path d="m16.95 16.95 2.12 2.12"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="m4.93 19.07 2.12-2.12"/><path d="m16.95 7.05 2.12-2.12"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.2 2.4 3.2 5.1 3.2 9s-1 6.6-3.2 9c-2.2-2.4-3.2-5.1-3.2-9s1-6.6 3.2-9z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/><path d="M12 7v5l3 2"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7h.01"/>',
    layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16"/><path d="M3 9h18"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    moon: '<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4a7 7 0 1 0 11.5 11.5z"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    reload: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v6h-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    spark: '<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 16h10l1-16"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
  };

  function svg(name) {
    const paths = ICONS[name] || ICONS.info;
    return `<svg class="nyra-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
  }

  function mount(scope = document) {
    scope.querySelectorAll("[data-icon]").forEach((element) => {
      element.innerHTML = svg(element.dataset.icon);
      element.classList.add("icon");
    });
  }

  root.NyraIcons = { mount, svg };
})(typeof globalThis !== "undefined" ? globalThis : window);
