import test from "node:test";
import assert from "node:assert/strict";
import "../src/settings.js";
const { normalize, buildCss, presets, defaults } = globalThis.YTM;
test("invalid imports cannot inject CSS or introduce unsupported settings", () => {
  const s = normalize({
    background: "#fff;}body{display:none}",
    enabled: "false",
    theme: "__proto__",
    queueWidth: 900,
    padding: -9,
    volumeWidth: NaN,
    surprise: true,
  });
  assert.equal(s.background, defaults.background);
  assert.equal(s.enabled, true);
  assert.equal(s.theme, defaults.theme);
  assert.equal(s.queueWidth, 100);
  assert.equal(s.padding, 0);
  assert.equal(s.volumeWidth, 100);
  assert.equal(s.surprise, undefined);
  for (const raw of [null, [], "oops"])
    assert.deepEqual(normalize(raw), defaults);
});
test("every preset produces its palette and original leaves colors alone", () => {
  for (const [theme, preset] of Object.entries(presets)) {
    const css = buildCss({ theme });
    if (theme === "YoutubeMusicDefault")
      assert.ok(!css.includes("--ytmusic-general-background-a:"));
    else assert.ok(css.includes(preset.background));
  }
});
test("power off fully removes styling and feature switches are reversible", () => {
  assert.equal(buildCss({ enabled: false }), "");
  assert.ok(
    buildCss({ hideVideo: true }).includes("#main-panel { display: none"),
  );
  assert.ok(!buildCss({ hideVideo: false }).includes("#main-panel"));
  assert.ok(
    !buildCss({ showVolumePercentage: false }).includes(
      "ytm-volume-percentage",
    ),
  );
  assert.ok(!buildCss({ hidePromos: false }).includes("mealbar"));
  assert.ok(buildCss({ hidePromos: true }).includes("mealbar"));
});
test("custom palette and bounded layout values reach generated CSS", () => {
  const css = buildCss({
    theme: "UserDefined",
    background: "#123456",
    player: "#654321",
    accent: "#abcdef",
    customWidth: true,
    queueWidth: 73,
    volumeWidth: 140,
    padding: 25,
  });
  for (const value of ["#123456", "#654321", "#abcdef", "73%", "140px", "25px"])
    assert.ok(css.includes(value));
});

test("theme text meets WCAG AA contrast on canvas, player and accent", () => {
  const { colors, luminance } = globalThis.YTM;
  const contrast = (a, b) =>
    (Math.max(luminance(a), luminance(b)) + 0.05) /
    (Math.min(luminance(a), luminance(b)) + 0.05);
  for (const [name, palette] of Object.entries(presets)) {
    const tone = colors(palette);
    for (const [surface, text] of [
      [palette.background, tone.text],
      [palette.background, tone.secondary],
      [palette.player, tone.playerText],
      [palette.accent, tone.onAccent],
    ]) {
      assert.ok(
        contrast(surface, text) >= 4.5,
        `${name}: ${surface}/${text} must be readable`,
      );
    }
  }
});
