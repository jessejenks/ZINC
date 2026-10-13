import { deepStrictEqual } from "node:assert";
import test, { suite } from "node:test";
import { wasmEncoder } from "../../src";
import { ast, zincWasm } from "../../src/recursion";

const { variable: v, application: app, abstraction: abs, letIn, ifElse, bool, int, unary, binary } = ast;

const negate = (e: ast.Expression) => unary(ast.UnaryOp.Negate, e);
const add = (l: ast.Expression, r: ast.Expression) => binary(ast.BinaryOp.Add, l, r);
const sub = (l: ast.Expression, r: ast.Expression) => binary(ast.BinaryOp.Sub, l, r);
const mul = (l: ast.Expression, r: ast.Expression) => binary(ast.BinaryOp.Mul, l, r);
const lt = (l: ast.Expression, r: ast.Expression) => binary(ast.BinaryOp.Lt, l, r);
const eq = (l: ast.Expression, r: ast.Expression) => binary(ast.BinaryOp.Eq, l, r);

// λn. if n == 0 then 1 else n * f (n - 1)
const FACT_BODY = abs(ifElse(eq(v(0), int(0)), int(1), mul(v(0), app(v(1), sub(v(0), int(1))))));

const cases: [ast.Expression, number][] = [
	[int(1), 1],
	[int(54321), 54321],
	[int(-54321), -54321],
	[negate(int(1)), -1],
	[add(int(1), int(2)), 3],
	[mul(int(2), int(3)), 6],
	[app(abs(v(0)), add(int(1), int(2))), 3],
	[app(abs(add(v(0), int(2))), int(1)), 3],
	// booleans are implemented as 0 / 1
	[bool(true), 1],
	[lt(int(1), int(2)), 1],
	// let
	[letIn(int(1), add(v(0), v(0)), false), 2],
	// if, in both tail and non-tail position
	[ifElse(lt(int(1), int(2)), int(3), int(4)), 3],
	[add(ifElse(bool(false), int(1), int(2)), int(10)), 12],
	[app(abs(ifElse(v(0), int(1), int(2))), bool(false)), 2],
	// let rec
	[letIn(FACT_BODY, app(v(0), int(3)), true), 6],
	[letIn(FACT_BODY, app(v(0), int(5)), true), 120],
];

suite("ZINC WASM", () => {
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
