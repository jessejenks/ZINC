import { deepStrictEqual, throws } from "node:assert";
import test, { suite } from "node:test";
import { ast, elaborate, parser, surface } from "../../src/pure";

const { variable: v, application: app, abstraction: abs } = surface;

const cases: [string, surface.Expression][] = [
	["x", v("x")],
	["x_y", v("x_y")],
	["x''''", v("x''''")],
	["(x)", v("x")],
	["λx.x", abs("x", v("x"))],
	["\\x.x", abs("x", v("x"))],
	["x'y", app(v("x'"), v("y"))],
	["f g h", app(app(v("f"), v("g")), v("h"))],
	["f (g h)", app(v("f"), app(v("g"), v("h")))],
	["λx. f x g", abs("x", app(app(v("f"), v("x")), v("g")))],
	["λx. f (g x)", abs("x", app(v("f"), app(v("g"), v("x"))))],
	["f λx.x y", app(v("f"), abs("x", app(v("x"), v("y"))))],
	["(λx.x) (λy.y) z", app(app(abs("x", v("x")), abs("y", v("y"))), v("z"))],
	["λf.λx.f (f x)", abs("f", abs("x", app(v("f"), app(v("f"), v("x")))))],
];

suite("Parser", () => {
	for (const [input, expected] of cases) {
		test(`Parses '${input}' as ${surface.toString(expected)}`, () => {
			const p = new parser.Parser();
			const parsed = p.parse(input);
			deepStrictEqual(parsed, expected);
		});
	}
});

const errorCases: string[] = ["", "λ.x", "λx x", "(x", "x)", "1"];

suite("Parser errors", () => {
	for (const input of errorCases) {
		test(`Rejects '${input}'`, () => {
			const p = new parser.Parser();
			throws(() => p.parse(input));
		});
	}
});

test("Reports the position of the offending token", () => {
	const p = new parser.Parser();
	throws(() => p.parse("λx.\n  f )"), { message: "Parse error @ (2, 5): expected <eof> but got right-paren" });
});

const freeVariableCases: [string, string[]][] = [
	["λx.x", []],
	["λx.y z", ["z", "y"]],
	["λx.(λz.z) z (λz.z)", ["z"]],
];

suite("Free variables", () => {
	for (const [input, expected] of freeVariableCases) {
		test(`Collects free variables of '${input}'`, () => {
			const p = new parser.Parser();
			const { free } = elaborate.surfaceToCore(p.parse(input));
			deepStrictEqual(free, expected);
		});
	}
});

const elaborationCases: [string, ast.Expression][] = [
	["λx.x", ast.abstraction(ast.variable(0))],
	["λx.λy.y", ast.abstraction(ast.abstraction(ast.variable(0)))],
	["λx.y", ast.abstraction(ast.variable(1))],
	["λx.y z", ast.abstraction(ast.application(ast.variable(1), ast.variable(2)))],
	["λx.y (λw.y)", ast.abstraction(ast.application(ast.variable(1), ast.abstraction(ast.variable(2))))],
	[
		"λx.(λz.z) z (λz.z)",
		ast.abstraction(
			ast.application(
				ast.application(ast.abstraction(ast.variable(0)), ast.variable(1)),
				ast.abstraction(ast.variable(0)),
			),
		),
	],
	["λx.λy.x", ast.abstraction(ast.abstraction(ast.variable(1)))],
	[
		"λx.λy.λx.y x",
		ast.abstraction(ast.abstraction(ast.abstraction(ast.application(ast.variable(1), ast.variable(0))))),
	],
	["(λx.x) (λy.y)", ast.application(ast.abstraction(ast.variable(0)), ast.abstraction(ast.variable(0)))],
];

suite("Elaborator", () => {
	for (const [input, expected] of elaborationCases) {
		test(`Elaborates '${input}' to ${ast.toString(expected)}`, () => {
			const p = new parser.Parser();
			const parsed = p.parse(input);
			const { expr, names, free } = elaborate.surfaceToCore(parsed);
			deepStrictEqual(expr, expected);
			deepStrictEqual(elaborate.surfaceToCore(elaborate.coreToSurface(expr, names, free)).expr, expr);
		});
	}
});
