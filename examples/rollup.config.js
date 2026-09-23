import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import fs from "node:fs";
import path from "node:path";

const EXAMPLES_DIR = "./examples";
const examples = Object.fromEntries(
	fs
		.readdirSync(EXAMPLES_DIR, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
		.map((entry) => {
			const filePath = path.join(entry.parentPath, entry.name);
			const { dir, name } = path.parse(path.relative(EXAMPLES_DIR, filePath));
			return [path.join(dir, name), filePath];
		}),
);

export default {
	input: examples,
	output: [
		{
			dir: "dist/examples",
			format: "cjs",
			entryFileNames: "[name].cjs",
			chunkFileNames: "[name]-[hash].cjs",
		},
	],
	plugins: [typescript({ tsconfig: "./examples/tsconfig.json" }), terser()],
};
