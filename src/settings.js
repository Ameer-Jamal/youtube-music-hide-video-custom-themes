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
    Slate: {
      name: "Slate",
      background: "#171e29",
      player: "#222d3c",
      accent: "#9ab8dd",
    },
    Ocean: {
      name: "Deep ocean",
      background: "#081c24",
      player: "#102e39",
      accent: "#67d8e7",
    },
    Forest: {
      name: "Forest",
      background: "#101f18",
      player: "#1c3225",
      accent: "#a0d8a6",
    },
    WarmGraphite: {
      name: "Warm graphite",
      background: "#201c19",
      player: "#302823",
      accent: "#e3b88b",
    },
    Rosewood: {
      name: "Rosewood",
      background: "#25151d",
      player: "#39212d",
      accent: "#efa4c1",
    },
    Sunset: {
      name: "Sunset",
      background: "#251711",
      player: "#3c251c",
      accent: "#ffb086",
    },
    Nord: {
      name: "Nord",
      background: "#2e3440",
      player: "#3b4252",
      accent: "#88c0d0",
    },
    Dracula: {
      name: "Dracula",
      background: "#282a36",
      player: "#343746",
      accent: "#bd93f9",
    },
    TokyoNight: {
      name: "Tokyo night",
      background: "#1a1b26",
      player: "#24283b",
      accent: "#7aa2f7",
    },
    Coffee: {
      name: "Coffee",
      background: "#241e1b",
      player: "#382e28",
      accent: "#d6bd98",
    },
    Paper: {
      name: "Paper",
      background: "#faf9f6",
      player: "#eeeae2",
      accent: "#705836",
    },
    Pearl: {
      name: "Pearl",
      background: "#f6f8fc",
      player: "#e7edf5",
      accent: "#315dad",
    },
    Lavender: {
      name: "Lavender mist",
      background: "#f4effb",
      player: "#e7ddf2",
      accent: "#7450a4",
    },
    Mint: {
      name: "Mint cream",
      background: "#f0f8f3",
      player: "#dcece2",
      accent: "#27734f",
    },
    Sky: {
      name: "Sky blue",
      background: "#eff7fc",
      player: "#dcebf6",
      accent: "#246687",
    },
    Peach: {
      name: "Peach",
      background: "#fff4eb",
      player: "#f4e2d3",
      accent: "#a34b26",
    },
    Blush: {
      name: "Blush",
      background: "#fff1f5",
      player: "#f2dfe6",
      accent: "#a13562",
    },
    Sand: {
      name: "Desert sand",
      background: "#f7f1e5",
      player: "#e9ddc5",
      accent: "#785c26",
    },
    Ice: {
      name: "Ice",
      background: "#f0f9f9",
      player: "#dceeee",
      accent: "#236c70",
    },
    Silver: {
      name: "Silver",
      background: "#f4f4f5",
      player: "#e3e3e7",
      accent: "#575580",
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
    wideHome: false,
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
  function luminance(hex) {
    const rgb = hex
      .slice(1)
      .match(/../g)
      .map((v) => parseInt(v, 16) / 255);
    return rgb
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  }
  function foreground(hex) {
    return luminance(hex) > 0.179 ? "#111111" : "#ffffff";
  }
  function colors(palette) {
    const light = foreground(palette.background) === "#111111";
    return {
      light,
      text: foreground(palette.background),
      secondary: light ? "#48484f" : "#bcbcc6",
      playerText: foreground(palette.player),
      onAccent: foreground(palette.accent),
    };
  }
  function buildHomeCss(palette) {
    // Home owns one gradient across the entire feed, rather than an artwork
    // backdrop whose finite height ends at the first carousel. Route scoping
    // preserves album/artist hero artwork and the separate player canvas.
    const home = "html[data-ytm-home]";
    return `
      ${home} #browse-page > #background,
      ${home} #browse-page > ytmusic-fullbleed-thumbnail-renderer,
      ${home} ytmusic-browse-response > #background,
      ${home} ytmusic-browse-response > ytmusic-fullbleed-thumbnail-renderer {
        display: none !important;
      }
      ${home} ytmusic-browse-response#browse-page {
        min-height: 100vh;
        background: linear-gradient(to bottom, ${palette.accent}18 0px, ${palette.accent}09 220px, ${palette.accent}00 620px), ${palette.background} !important;
      }
      ${home} ytmusic-browse-response #background-gradient,
      ${home} ytmusic-browse-response .background-gradient {
        background: none !important;
      }
      ${home} ytmusic-browse-response #header,
      ${home} ytmusic-browse-response #content-wrapper,
      ${home} ytmusic-browse-response #contents,
      ${home} ytmusic-browse-response #content,
      ${home} ytmusic-browse-response ytmusic-section-list-renderer,
      ${home} ytmusic-browse-response ytmusic-carousel-shelf-renderer,
      ${home} ytmusic-browse-response .ytmusic-shelf.ytmusic-carousel-shelf-renderer {
        background: transparent !important;
      }
    `;
  }
  function buildCss(raw) {
    const s = normalize(raw);
    if (!s.enabled) return "";
    const palette = s.theme === "UserDefined" ? s : presets[s.theme];
    const tone = colors(palette);
    let css = "";
    if (s.theme !== "YoutubeMusicDefault")
      css += `
   html { --ytmusic-background: ${palette.background} !important; --ytmusic-general-background-a: ${palette.background} !important; --ytmusic-general-background-b: ${palette.background} !important; --ytmusic-general-background-c: ${palette.background} !important; --ytmusic-general-background-d: ${palette.background} !important; --ytmusic-brand-background-solid: ${palette.player} !important; --yt-spec-base-background: ${palette.background} !important; --yt-spec-brand-background-solid: ${palette.background} !important; --ytmusic-color-white1: ${tone.text} !important; --ytmusic-color-white2: ${tone.secondary} !important; --ytmusic-color-white3: ${tone.secondary} !important; --ytmusic-color-grey1: ${tone.text} !important; --ytmusic-color-grey2: ${tone.secondary} !important; --ytmusic-color-grey3: ${tone.secondary} !important;
   --ytmusic-text-primary: ${tone.text} !important; --ytmusic-text-secondary: ${tone.secondary} !important; --yt-spec-text-primary: ${tone.text} !important; --yt-spec-text-secondary: ${tone.secondary} !important;
   --ytmusic-paper-item: ${tone.text} !important; --ytmusic-paper-item-hover: ${palette.accent}22 !important; --ytmusic-paper-item-focus: ${palette.accent}33 !important;
   --ytmusic-menu-background: ${palette.player} !important; --ytmusic-dialog-background: ${palette.player} !important;
   --ytmusic-play-button-background-color: ${palette.accent} !important; --ytmusic-play-button-active-background-color: ${palette.accent} !important; --ytmusic-play-button-icon-color: ${tone.onAccent} !important;
   --yt-spec-icon-active-other: ${tone.text} !important; --yt-spec-icon-inactive: ${tone.secondary} !important; color-scheme: ${tone.light ? "light" : "dark"}; color: ${tone.text}; }
   html, body, ytmusic-app, ytmusic-app-layout > #content, ytmusic-nav-bar, ytmusic-tabs.stuck, ytmusic-player-page #side-panel, ytmusic-player-page #tabsContent, #sections.ytmusic-guide-renderer { background-color: ${palette.background} !important; }
   ytmusic-app-layout, ytmusic-player-page, ytmusic-search-page, ytmusic-guide-renderer { background: ${palette.background} !important; }
   ytmusic-player-page #background { background: none !important; }
   ytmusic-player-page #tab-renderer, ytmusic-player-page #tabsContent, ytmusic-player-page #side-panel { background: transparent !important; }
   ytmusic-nav-bar, ytmusic-tabs.stuck, ytmusic-guide-renderer #sections { background: ${palette.background} !important; }
   ytmusic-player-bar { background-color: ${palette.player} !important; color: ${tone.playerText} !important; --ytmusic-text-primary: ${tone.playerText} !important; --ytmusic-text-secondary: ${tone.playerText}b3 !important; --ytmusic-color-white1: ${tone.playerText} !important; --ytmusic-color-white2: ${tone.playerText}b3 !important; }
   ytmusic-player-bar :is(.play-pause-button, #play-pause-button) { background: ${palette.accent} !important; color: ${tone.onAccent} !important; border-radius: 50%; }
   ytmusic-player-bar :is(.left-controls, #left-controls) :is(tp-yt-paper-icon-button, yt-icon-button, button) { color: ${palette.accent} !important; }
   ytmusic-player-bar :is(.play-pause-button, #play-pause-button) yt-icon { color: ${tone.onAccent} !important; }
   ytmusic-chip-cloud-chip-renderer { --ytmusic-chip-background: ${palette.accent}18 !important; --ytmusic-chip-active-background: ${palette.accent} !important; --ytmusic-chip-active-text: ${tone.onAccent} !important; }
   ytmusic-chip-cloud-chip-renderer :is(a, .gradient-box), ytmusic-play-button-renderer #play-button { background: ${palette.accent}18 !important; color: ${tone.text} !important; border-radius: 999px; }
   ytmusic-chip-cloud-chip-renderer .gradient-box { background: none !important; }
   ytmusic-chip-cloud-chip-renderer a { border: 1px solid ${palette.accent}55 !important; }
   ytmusic-chip-cloud-chip-renderer a:hover { background: ${palette.accent}30 !important; }
   ytmusic-chip-cloud-chip-renderer[selected] a, ytmusic-chip-cloud-chip-renderer a[aria-selected="true"], ytmusic-play-button-renderer #play-button { background: ${palette.accent} !important; color: ${tone.onAccent} !important; }
   ytmusic-chip-cloud-chip-renderer :is(yt-icon, yt-formatted-string) { color: inherit !important; }
   ytmusic-guide-entry-renderer[active] { background: ${palette.accent}22 !important; border-radius: 10px; }
   ytmusic-search-box { --ytmusic-search-background: ${palette.accent}15 !important; }
   ytmusic-player-bar #progress-bar, ytmusic-player-bar .volume-slider { --paper-slider-active-color: ${palette.accent} !important; --paper-slider-knob-color: ${palette.accent} !important; }
   ::-webkit-scrollbar { width: 8px; height: 8px; } ::-webkit-scrollbar-thumb { background: ${palette.accent}66; border-radius: 12px; } ::-webkit-scrollbar-track { background: transparent; }
  `;
    if (s.theme !== "YoutubeMusicDefault") css += buildHomeCss(palette);
    if (s.wideHome)
      css += `
      html[data-ytm-wide-home] ytmusic-browse-response { --ytmusic-content-width: 100%; --ytmusic-content-width-extra-wide: 100%; }
      html[data-ytm-wide-home] ytmusic-browse-response #content-wrapper { max-width: none !important; width: 100% !important; }
      html[data-ytm-wide-home] ytmusic-browse-response .ytmusic-shelf { width: auto !important; max-width: none !important; box-sizing: border-box; margin-inline: 0 !important; padding-inline: clamp(16px, 3vw, 48px) !important; }
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
  globalThis.YTM = Object.freeze({
    presets,
    defaults,
    normalize,
    buildCss,
    colors,
    luminance,
    foreground,
  });
})();
