import type { GlobeTheme } from "@mark1russell7/visuals/globe";

/** This function reads a color of the page: the value of a custom property of the root element, as a CSS hex color. */
function color(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** The part of the light that the surface of a warning area of each level stops. A higher level stops more light. */
const AREA_OPACITY = { advisory: 0.3, watch: 0.36, warning: 0.44 } as const;

/**
 * This function makes the theme of the globe from the colors of the page.
 * The style sheet is the one home of each color, so the legend and the globe always agree.
 */
export function globeTheme(): GlobeTheme {
  const ring = color("--quake-ring");
  return {
    // The globe has no surface that takes light, so the colors of the light change nothing.
    sky: "#ffffff",
    ground: "#ffffff",
    ball: color("--sea"),
    grid: color("--grid"),
    shade: color("--rim"),
    styles: {
      land: { fill: color("--land") },
      advisory: { fill: color("--advisory"), opacity: AREA_OPACITY.advisory, line: color("--advisory") },
      watch: { fill: color("--watch"), opacity: AREA_OPACITY.watch, line: color("--watch") },
      warning: { fill: color("--warning"), opacity: AREA_OPACITY.warning, line: color("--warning") },
      quake: { fill: color("--quake"), line: ring },
    },
    other: { fill: color("--land") },
    hovered: color("--mark"),
    selected: color("--mark-strong"),
  };
}

const darkScheme = matchMedia("(prefers-color-scheme: dark)");

/**
 * This function starts `change` each time the page changes between its light colors and its dark colors.
 * The site of `room-view` has the same function. The two functions move to `@mark1russell7/site-pages/chrome`.
 */
export function onThemeChange(change: () => void): void {
  new MutationObserver(change).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  darkScheme.addEventListener("change", change);
}
