(() => {
  const presets = {
    YoutubeMusicDefault: {
      name: "YouTube original",
      background: "#030303",
      player: "#212121",
      accent: "#ff4545",
    },
    MaterialDark: {
      name: "Material dark",
      background: "#121212",
      player: "#1e1e1e",
      accent: "#c5b4ff",
    },
    GalaxyPurple: {
      name: "Galaxy purple",
      background: "#10001b",
      player: "#1a001d",
      accent: "#c69cff",
    },
    MidnightBlue: {
      name: "Midnight blue",
      background: "#0a0f1b",
      player: "#162945",
      accent: "#87baff",
    },
    CrimsonNight: {
      name: "Crimson night",
      background: "#1b000a",
      player: "#280c00",
      accent: "#ff8f9f",
    },
    EmeraldShadow: {
      name: "Emerald shadow",
      background: "#001d0d",
      player: "#062511",
      accent: "#80deb0",
    },
    PureBlack: {
      name: "Pure black",
      background: "#000000",
      player: "#000000",
      accent: "#ffffff",
    },
    UserDefined: {
      name: "Your palette",
      background: "#121212",
      player: "#1e1e1e",
      accent: "#c5b4ff",
    },
  };
  const defaults = {
    enabled: true,
    hideVideo: true,
    theme: "MaterialDark",
    background: "#121212",
    player: "#1e1e1e",
    accent: "#c5b4ff",
    showVolume: true,
    showVolumePercentage: true,
    volumeWidth: 100,
    customWidth: false,
    queueWidth: 100,
    padding: 16,
    hidePromos: false,
  };
  function normalize(raw = {}) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) raw = {};
    const s = { ...defaults };
    for (const key of Object.keys(s)) {
      if (typeof s[key] === "boolean" && typeof raw[key] === "boolean")
        s[key] = raw[key];
    }
    if (Object.hasOwn(presets, raw.theme)) s.theme = raw.theme;
    for (const key of ["background", "player", "accent"])
      if (typeof raw[key] === "string" && /^#[\da-f]{6}$/i.test(raw[key]))
        s[key] = raw[key].toLowerCase();
    for (const [key, min, max] of [
      ["volumeWidth", 60, 180],
      ["queueWidth", 50, 100],
      ["padding", 0, 48],
    ])
      if (Number.isFinite(raw[key]))
        s[key] = Math.round(Math.max(min, Math.min(max, raw[key])));
    return s;
  }
  function buildCss(raw) {
    const s = normalize(raw);
    if (!s.enabled) return "";
    const palette = s.theme === "UserDefined" ? s : presets[s.theme];
    let css = "";
    if (s.theme !== "YoutubeMusicDefault")
      css += `
   html { --ytmusic-general-background-a: ${palette.background} !important; --ytmusic-general-background-b: ${palette.background} !important; --ytmusic-general-background-c: ${palette.background} !important; --ytmusic-general-background-d: ${palette.background} !important; --ytmusic-brand-background-solid: ${palette.player} !important; --yt-spec-base-background: ${palette.background} !important; --yt-spec-brand-background-solid: ${palette.background} !important; --ytmusic-color-white1: #f5f5f5; }
   html, body, ytmusic-app, ytmusic-app-layout > #content, ytmusic-nav-bar, ytmusic-tabs.stuck, ytmusic-player-page #side-panel, ytmusic-player-page #tabsContent, #sections.ytmusic-guide-renderer { background-color: ${palette.background} !important; }
   /* Keep one canvas under the native header and browse shelves. YouTube's
      artwork-derived background layer otherwise ends at the first shelf. */
   ytmusic-app-layout, ytmusic-browse-response, ytmusic-player-page, ytmusic-search-page, ytmusic-guide-renderer { background: ${palette.background} !important; }
   ytmusic-app > #background, #background.ytmusic-app, ytmusic-app-layout #background, ytmusic-browse-response > #background, ytmusic-browse-response #background-gradient, ytmusic-browse-response .background-gradient, ytmusic-player-page #background { background: none !important; }
   ytmusic-browse-response #header, ytmusic-browse-response #contents, ytmusic-browse-response ytmusic-carousel-shelf-renderer, ytmusic-player-page #tab-renderer, ytmusic-player-page #tabsContent, ytmusic-player-page #side-panel { background: transparent !important; }
   ytmusic-nav-bar, ytmusic-tabs.stuck, ytmusic-guide-renderer #sections { background: ${palette.background} !important; }
   ytmusic-player-bar { background-color: ${palette.player} !important; }
   ytmusic-player-bar #progress-bar, ytmusic-player-bar .volume-slider { --paper-slider-active-color: ${palette.accent} !important; --paper-slider-knob-color: ${palette.accent} !important; }
   ::-webkit-scrollbar { width: 8px; height: 8px; } ::-webkit-scrollbar-thumb { background: ${palette.accent}66; border-radius: 12px; } ::-webkit-scrollbar-track { background: transparent; }
  `;
    if (s.hideVideo)
      css += `
   ytmusic-player-page #main-panel { display: none !important; }
   ytmusic-player-page { --ytmusic-player-page-content-gap: 0px !important; }
   ytmusic-player-page .content { display: flex !important; justify-content: center; }
   ytmusic-player-page #side-panel { flex: 1 1 100% !important; width: 100% !important; max-width: none !important; min-width: 0 !important; }
   ytmusic-player-page #tab-renderer { width: 100% !important; max-width: none !important; }
  `;
    if (s.customWidth)
      css += `ytmusic-player-page #side-panel { flex: 0 1 ${s.queueWidth}% !important; width: ${s.queueWidth}% !important; max-width: ${s.queueWidth}% !important; }`;
    if (s.hideVideo || s.customWidth)
      css += `ytmusic-player-page .content { padding: ${s.padding}px !important; box-sizing: border-box; }`;
    if (s.showVolume)
      css += `ytmusic-player-bar .volume-slider { opacity: 1 !important; pointer-events: auto !important; }`;
    css += `ytmusic-player-bar .volume-slider, ytmusic-player-bar .expand-volume-slider { width: ${s.volumeWidth}px !important; } ytmusic-player-bar #right-controls { width: auto !important; }`;
    if (s.showVolumePercentage)
      css += `ytmusic-player-bar .ytm-volume-percentage { display: inline-flex; align-items: center; justify-content: flex-end; flex: 0 0 4ch; min-width: 4ch; margin-inline: 8px; color: var(--ytmusic-text-secondary, #bababa); font: 500 11px/1.2 system-ui, sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap; pointer-events: none; }`;
    if (s.hidePromos)
      css += `ytmusic-mealbar-promo-renderer { display: none !important; }`;
    return css;
  }
  globalThis.YTM = Object.freeze({ presets, defaults, normalize, buildCss });
})();
