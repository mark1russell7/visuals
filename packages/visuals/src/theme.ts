/**
 * The colors that each stage uses. Each color is a CSS hex color, for example `#22364a`.
 * A stage has no background: the page shows behind the content. The theme of a content adds its own colors.
 */
export interface StageTheme {
  /** The color of the light from above. */
  readonly sky: string;
  /** The color of the light from below. */
  readonly ground: string;
}
