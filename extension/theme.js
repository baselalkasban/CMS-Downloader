// Runs before the page renders: applies the chosen theme and marks Pro mode, so the CMS never flashes unstyled.
(() => {
  const root = document.documentElement;
  const read = (key, fallback) => {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  };
  const apply = (theme) => {
    if (!CMSThemes.some((t) => t.id === theme)) theme = CMSThemes[0].id;
    root.dataset.cmsvTheme = theme;
    root.classList.toggle('cmsv-light', !CMSThemes.find((t) => t.id === theme).dark);
    try {
      localStorage.setItem('cmsv:theme', theme);
    } catch {}
  };

  apply(read('cmsv:theme', CMSThemes[0].id));
  root.classList.toggle('cmsv-pro', read('cmsv:mode', 'pro') === 'pro');

  // The popup and the command palette save the theme in extension storage; follow it live in every tab.
  chrome.storage.sync.get({ theme: null }).then(({ theme }) => theme && apply(theme));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.theme?.newValue) apply(changes.theme.newValue);
  });
})();
