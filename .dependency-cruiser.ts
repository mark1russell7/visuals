// The import boundaries of the workspace (@mark1russell7/boundaries): another package is imported only
// through an entry of its package.json. Start the check with `pnpm check:boundaries`.
import { boundaries, defaultOptions, type Config } from "@mark1russell7/boundaries";

const root = import.meta.dirname;

// The default options remove each module of node_modules from the graph, so a rule cannot name three.js.
// This list keeps those modules as leaves: the analysis reads their names, and it does not follow their imports.
const defaults = defaultOptions(root)["exclude"] as { readonly path: readonly string[] };
const exclude = defaults.path.filter((path) => !path.includes("node_modules"));

const config: Config = boundaries(root, {
  options: { exclude: { path: exclude } },
  forbidden: [
    {
      name: "data-entry-no-three",
      severity: "error",
      comment:
        "The entries `.` and `./marks` of @mark1russell7/visuals are data and maths. They import no three.js, also not through a different file. A package with no browser imports them.",
      from: { path: "^packages/visuals/src/(index|marks)\\.ts$" },
      to: { path: "(^|/)node_modules/(@types/)?three(/|$)", reachable: true },
    },
  ],
});
export default config;
