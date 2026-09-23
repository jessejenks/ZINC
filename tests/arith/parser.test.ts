import { deepStrictEqual } from "node:assert";
import test, { suite } from "node:test";
import { ast, elaborate, parser, surface } from "../../src/arith";

const { variable: v, application: app, abstraction: abs, letIn, unit, int, negate, add, sub, mul } = surface;

const cases: [string, surface.Expression][] = [
	["()", unit()],
	["1", int(1)],
	["x", v("x")],
	["(x)", v("x")],
	["λx.x", abs("x", v("x"))],
	["f g h", app(app(v("f"), v("g")), v("h"))],
	["f (g h)", app(v("f"), app(v("g"), v("h")))],
	["1 + 2", add(int(1), int(2))],
	["1 + 2 + 3", add(add(int(1), int(2)), int(3))],
	["1 + 2 * 3", add(int(1), mul(int(2), int(3)))],
	["1 * 2 * 3", mul(mul(int(1), int(2)), int(3))],
	["1 + - 2", add(int(1), negate(int(2)))],
	["1 + - - - - 2", add(int(1), negate(negate(negate(negate(int(2))))))],
	["1 + 2 * - 3", add(int(1), mul(int(2), negate(int(3))))],
	["x-y", sub(v("x"), v("y"))],
	["x_y", v("x_y")],
	["λx. f x g", abs("x", app(app(v("f"), v("x")), v("g")))],
	["λx. f (g x)", abs("x", app(v("f"), app(v("g"), v("x"))))],
	["(λx.x) (λy.y + 1) 4", app(app(abs("x", v("x")), abs("y", add(v("y"), int(1)))), int(4))],
	[
		"let f = λx.x in let g = λy.y + 1 in f g 4",
		letIn("f", abs("x", v("x")), letIn("g", abs("y", add(v("y"), int(1))), app(app(v("f"), v("g")), int(4)))),
	],
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

const elaborationCases: [string, ast.Expression][] = [
	["λx.x", ast.abstraction(ast.variable(0))],
	["λx.λy.y", ast.abstraction(ast.abstraction(ast.variable(0)))],
	["λx.λy.λx.y + x", ast.abstraction(ast.abstraction(ast.abstraction(ast.add(ast.variable(1), ast.variable(0)))))],
	["let x = 2 in x + 1", ast.application(ast.abstraction(ast.add(ast.variable(0), ast.int(1))), ast.int(2))],
	["let x = 2 in x", ast.application(ast.abstraction(ast.variable(0)), ast.int(2))],
	["let x = 2 in λx.x", ast.application(ast.abstraction(ast.abstraction(ast.variable(0))), ast.int(2))],
];

suite("Elaborator", () => {
	for (const [input, expected] of elaborationCases) {
		test(`Elaborates '${input}' to ${ast.toString(expected)}`, () => {
			const p = new parser.Parser();
			const parsed = p.parse(input);
			const expr = elaborate.surfaceToCore(parsed);
			deepStrictEqual(expr, expected);
		});
	}
});
