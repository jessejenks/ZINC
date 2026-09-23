import { deepStrictEqual } from "node:assert";
import test, { suite } from "node:test";
import { wasmEncoder } from "../../src";
import { ast, zincWasm } from "../../src/arith";

const { variable: v, application: app, abstraction: abs, int, negate, add, mul } = ast;

const cases: [ast.Expression, number][] = [
	[int(1), 1],
	[int(54321), 54321],
	[int(-54321), -54321],
	[negate(int(1)), -1],
	[add(int(1), int(2)), 3],
	[mul(int(2), int(3)), 6],
	[app(abs(v(0)), add(int(1), int(2))), 3],
	[app(abs(add(v(0), int(2))), int(1)), 3],
];

suite("ZINC", () => {
	for (const [input, expected] of cases) {
		test(ast.toString(input), () => {
			const compiler = new zincWasm.Compiler();
			compiler.compile(input);
			const module = compiler.getModule();
			const bytes = wasmEncoder.encode(module);
			const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes));
			const resultWasm = (instance.exports.main as () => unknown)();
			deepStrictEqual(resultWasm, expected);
		});
	}
});
