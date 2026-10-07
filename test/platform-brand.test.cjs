const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const brandSource = read("lib/platform-brand.ts");
const badge = read("app/platform-badge.tsx");
const filters = read("app/filter-controls.tsx");
const workbench = read("app/campaign-workbench.tsx");
const page = read("app/page.tsx");
const css = read("app/globals.css");

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4),
    );

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

test("requested platform aliases resolve through one shared brand registry", () => {
  assert.match(brandSource, /aliases: \["강남맛집"\][\s\S]*?accent: "#F97316"/);
  assert.match(brandSource, /aliases: \["레뷰", "레뷰\(인플렉서\)"\][\s\S]*?accent: "#7C3AED"/);
  assert.match(brandSource, /aliases: \["리뷰노트", "리뷰노트\(공개목록\)"\][\s\S]*?accent: "#16A34A"/);
  assert.match(brandSource, /id: "dinnerqueen"[\s\S]*?source: "official-site"/);
  assert.match(brandSource, /id: "reviewus"[\s\S]*?source: "official-site"/);
  assert.match(brandSource, /id: "neutral"[\s\S]*?source: "neutral"/);
});

test("brand text colors keep WCAG AA contrast against their soft backgrounds", () => {
  const pairs = [
    ["#9A3412", "#FFF7ED"],
    ["#5B21B6", "#F5F3FF"],
    ["#166534", "#F0FDF4"],
    ["#9F1239", "#FFF1F2"],
    ["#1E40AF", "#EFF6FF"],
    ["#3F454E", "#F5F6F7"],
  ];

  for (const [ink, background] of pairs) {
    assert.ok(brandSource.includes(`ink: "${ink}"`));
    assert.ok(brandSource.includes(`soft: "${background}"`));
    assert.ok(contrast(ink, background) >= 4.5, `${ink} on ${background}`);
  }
});

test("filters, cards, detail and active filters reuse the shared platform treatment", () => {
  assert.match(badge, /platformBrandStyle\(platform\)/);
  assert.match(filters, /platform-filter-option[\s\S]*?platformBrandStyle\(item\)/);
  assert.match(workbench, /PlatformBadge platform=\{item\.platform\} className="inspector-platform"/);
  assert.match(workbench, /PlatformBadge platform=\{item\.platform\} className="platform-badge"/);
  assert.match(page, /PlatformBadge key=\{item\} platform=\{item\} className="active-platform-filter"/);
  assert.match(css, /platform-filter-option input:checked ~ \.platform-filter-label::after/);
  assert.match(css, /platform-filter-option input:focus-visible ~ \.platform-filter-label/);
  assert.match(css, /platform-filter-option input:disabled ~ \.platform-filter-label/);
});
