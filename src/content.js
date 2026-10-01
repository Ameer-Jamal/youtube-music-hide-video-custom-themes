(() => {
  const style = document.createElement("style");
  style.id = "ytm-custom-themes";
  let current = YTM.defaults;
  const readout = document.createElement("span");
  readout.className = "ytm-volume-percentage";
  readout.setAttribute("aria-hidden", "true");
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
      updateVolume();
    });
  });
  volumeObserver.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-valuenow", "muted", "class", "id"],
  });
  function apply() {
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
