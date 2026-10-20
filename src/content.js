(() => {
  const style = document.createElement("style");
  style.id = "ytm-custom-themes";
  style.dataset.version =
    chrome.runtime?.getManifest?.()?.version || "development";
  let current = YTM.defaults;
  const readout = document.createElement("span");
  readout.className = "ytm-volume-percentage";
  readout.setAttribute("aria-hidden", "true");
  function updateHomeRoute() {
    if (!document.documentElement) return;
    const home = location.pathname === "/" || location.pathname === "/home";
    document.documentElement.toggleAttribute(
      "data-ytm-wide-home",
      home && current.enabled && current.wideHome,
    );
    document.documentElement.toggleAttribute(
      "data-ytm-home",
      home && current.enabled && current.theme !== "YoutubeMusicDefault",
    );
  }
  document.addEventListener("yt-navigate-finish", updateHomeRoute);
  window.addEventListener("popstate", updateHomeRoute);
  function updateVolume() {
    if (!current.enabled || !current.showVolumePercentage) {
      readout.remove();
      return;
    }
    const bar = document.querySelector("ytmusic-player-bar");
    const slider = bar?.querySelector(
      "#volume-slider, .volume-slider, .expand-volume-slider",
    );
    const source = slider?.hasAttribute("aria-valuenow")
      ? slider
      : slider?.querySelector("[aria-valuenow]");
    const raw = source?.getAttribute("aria-valuenow");
    const value =
      raw === null || raw === undefined || raw.trim() === ""
        ? NaN
        : Number(raw);
    if (!slider || !Number.isFinite(value)) {
      readout.remove();
      return;
    }
    const muted = bar.hasAttribute("muted") || slider.hasAttribute("muted");
    const text = `${muted ? 0 : Math.round(Math.max(0, Math.min(100, value)))}%`;
    if (readout.textContent !== text) readout.textContent = text;
    // Insert beside the slider, never inside its custom-element internals.
    if (
      readout.parentElement !== slider.parentElement ||
      slider.nextSibling !== readout
    )
      slider.after(readout);
  }
  let volumeScheduled = false;
  const volumeObserver = new MutationObserver(() => {
    if (volumeScheduled) return;
    volumeScheduled = true;
    requestAnimationFrame(() => {
      volumeScheduled = false;
      updateHomeRoute();
      updateVolume();
    });
  });
  volumeObserver.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-valuenow", "muted", "class", "id"],
  });
  // Observe the dedicated inactivity prompt instead of spoofing page activity
  // or calling media.play(), which could undo an intentional manual pause.
  const confirmedPrompts = new Map();
  let nonstopObserver;
  function visiblePrompt(button) {
    return (
      button.isConnected &&
      !button.closest('[hidden], [aria-hidden="true"]') &&
      button.getClientRects().length > 0 &&
      getComputedStyle(button).visibility !== "hidden" &&
      getComputedStyle(button).visibility !== "collapse"
    );
  }
  function confirmInactivityPrompt() {
    for (const [button] of confirmedPrompts) {
      if (!visiblePrompt(button)) confirmedPrompts.delete(button);
    }
    if (!current.enabled || !current.nonstop) return;
    for (const prompt of document.querySelectorAll(
      "tp-yt-paper-dialog ytmusic-you-there-renderer",
    )) {
      // dialog-confirm is structural and works regardless of the UI language.
      const button = prompt.querySelector(
        "[dialog-confirm] button, button[dialog-confirm]",
      );
      if (
        !button ||
        button.disabled ||
        button.getAttribute("aria-disabled") === "true" ||
        !visiblePrompt(button) ||
        confirmedPrompts.has(button)
      )
        continue;
      confirmedPrompts.set(button, true);
      button.click();
    }
  }
  function updateNonstop() {
    if (!current.enabled || !current.nonstop) {
      nonstopObserver?.disconnect();
      nonstopObserver = undefined;
      confirmedPrompts.clear();
      return;
    }
    if (!nonstopObserver) {
      nonstopObserver = new MutationObserver((records) => {
        // Polymer can detach and reuse the same dialog and confirmation button.
        for (const record of records) {
          for (const removed of record.removedNodes) {
            for (const [button] of confirmedPrompts) {
              if (removed === button || removed.contains(button))
                confirmedPrompts.delete(button);
            }
          }
        }
        confirmInactivityPrompt();
      });
      nonstopObserver.observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: [
          "hidden",
          "aria-hidden",
          "aria-disabled",
          "disabled",
          "opened",
          "style",
          "class",
        ],
      });
    }
    confirmInactivityPrompt();
  }
  function apply() {
    updateNonstop();
    updateHomeRoute();
    style.textContent = YTM.buildCss(current);
    updateVolume();
    if (document.documentElement && !style.isConnected)
      document.documentElement.append(style);
  }
  // Register before the asynchronous read so changes cannot be lost during startup.
  let revision = 0;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings) {
      revision++;
      current = YTM.normalize(changes.settings.newValue);
      apply();
    }
  });
  const initialRevision = revision;
  chrome.storage.sync
    .get("settings")
    .then(({ settings }) => {
      if (revision === initialRevision) current = YTM.normalize(settings);
      apply();
    })
    .catch(() => apply());
  if (!document.documentElement) {
    const observer = new MutationObserver(() => {
      if (document.documentElement) {
        apply();
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true });
  }
})();
