import { deepStrictEqual } from "node:assert";
import test, { suite } from "node:test";
import { ast, elaborate, parser, surface } from "../../src/recursion";

const { variable: v, application: app, abstraction: abs, letIn, unit, bool, int, unary, binary, ifElse } = surface;

const negate = (e: surface.Expression) => unary(surface.UnaryOp.Negate, e);
const add = (l: surface.Expression, r: surface.Expression) => binary(surface.BinaryOp.Add, l, r);
const sub = (l: surface.Expression, r: surface.Expression) => binary(surface.BinaryOp.Sub, l, r);
const mul = (l: surface.Expression, r: surface.Expression) => binary(surface.BinaryOp.Mul, l, r);
const lt = (l: surface.Expression, r: surface.Expression) => binary(surface.BinaryOp.Lt, l, r);
const eq = (l: surface.Expression, r: surface.Expression) => binary(surface.BinaryOp.Eq, l, r);
const and = (l: surface.Expression, r: surface.Expression) => binary(surface.BinaryOp.And, l, r);
const or = (l: surface.Expression, r: surface.Expression) => binary(surface.BinaryOp.Or, l, r);

const cases: [string, surface.Expression][] = [
	["()", unit()],
	["1", int(1)],
	["true", bool(true)],
	["false", bool(false)],
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
	["1 + 2 * - 3 < 4", lt(add(int(1), mul(int(2), negate(int(3)))), int(4))],
	["1 < 2 && 3 < 4", and(lt(int(1), int(2)), lt(int(3), int(4)))],
	["a || b && c", or(v("a"), and(v("b"), v("c")))],
	["x-y", sub(v("x"), v("y"))],
	["x_y", v("x_y")],
	["λx. f x g", abs("x", app(app(v("f"), v("x")), v("g")))],
	["λx. f (g x)", abs("x", app(v("f"), app(v("g"), v("x"))))],
	["(λx.x) (λy.y + 1) 4", app(app(abs("x", v("x")), abs("y", add(v("y"), int(1)))), int(4))],
	[
		"let f = λx.x in let g = λy.y + 1 in f g 4",
		letIn(
			"f",
			abs("x", v("x")),
			letIn("g", abs("y", add(v("y"), int(1))), app(app(v("f"), v("g")), int(4)), false),
			false,
		),
	],
	[
		"let rec f = λx. f x in let g = λy.y + 1 in f g 4",
		letIn(
			"f",
			abs("x", app(v("f"), v("x"))),
			letIn("g", abs("y", add(v("y"), int(1))), app(app(v("f"), v("g")), int(4)), false),
			true,
		),
	],
	["if x then 1 else 2", ifElse(v("x"), int(1), int(2))],
	[
		"let rec f = λn. if n == 0 then 1 else n * f (n - 1) in f",
		letIn(
			"f",
			abs("n", ifElse(eq(v("n"), int(0)), int(1), mul(v("n"), app(v("f"), sub(v("n"), int(1)))))),
			v("f"),
			true,
		),
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
	[
		"λx.λy.λx.y + x",
		ast.abstraction(ast.abstraction(ast.abstraction(ast.binary(ast.BinaryOp.Add, ast.variable(1), ast.variable(0))))),
	],
	["let x = 2 in x + 1", ast.letIn(ast.int(2), ast.binary(ast.BinaryOp.Add, ast.variable(0), ast.int(1)), false)],
	["let x = 2 in x", ast.letIn(ast.int(2), ast.variable(0), false)],
	["let x = 2 in λx.x", ast.letIn(ast.int(2), ast.abstraction(ast.variable(0)), false)],
	["let rec x = 2 in x + 1", ast.letIn(ast.int(2), ast.binary(ast.BinaryOp.Add, ast.variable(0), ast.int(1)), true)],
	["let rec x = 2 in x", ast.letIn(ast.int(2), ast.variable(0), true)],
	["let rec x = 2 in λx.x", ast.letIn(ast.int(2), ast.abstraction(ast.variable(0)), true)],
	[
		"let rec f = λx.f x in f",
		ast.letIn(ast.abstraction(ast.application(ast.variable(1), ast.variable(0))), ast.variable(0), true),
	],
	[
		"let rec f = λn. if n == 0 then 1 else n * f (n - 1) in f 2",
		ast.letIn(
			ast.abstraction(
				ast.ifElse(
					ast.binary(ast.BinaryOp.Eq, ast.variable(0), ast.int(0)),
					ast.int(1),
					ast.binary(
						ast.BinaryOp.Mul,
						ast.variable(0),
						ast.application(ast.variable(1), ast.binary(ast.BinaryOp.Sub, ast.variable(0), ast.int(1))),
					),
				),
			),
			ast.application(ast.variable(0), ast.int(2)),
			true,
		),
	],
	[
		"(λa. let rec f = λn. a in f) 7",
		ast.application(ast.abstraction(ast.letIn(ast.abstraction(ast.variable(2)), ast.variable(0), true)), ast.int(7)),
	],
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
