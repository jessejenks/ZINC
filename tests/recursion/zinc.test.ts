import { deepStrictEqual } from "node:assert";
import test, { suite } from "node:test";
import { ast, reduce, zinc } from "../../src/recursion";
import * as list from "../../src/utils/list";

const { variable: v, application: app, abstraction: abs, letIn, ifElse, bool, int, binary } = ast;

const add = (l: ast.Expression, r: ast.Expression) => binary(ast.BinaryOp.Add, l, r);
const sub = (l: ast.Expression, r: ast.Expression) => binary(ast.BinaryOp.Sub, l, r);
const mul = (l: ast.Expression, r: ast.Expression) => binary(ast.BinaryOp.Mul, l, r);
const lt = (l: ast.Expression, r: ast.Expression) => binary(ast.BinaryOp.Lt, l, r);
const eq = (l: ast.Expression, r: ast.Expression) => binary(ast.BinaryOp.Eq, l, r);

const cases: [ast.Expression, zinc.Instruction[], zinc.Value][] = [
	[
		app(abs(v(0)), abs(abs(v(1)))),
		[
			{ kind: zinc.InstructionKind.Pushmark },
			{ kind: zinc.InstructionKind.Cur, addr: 5 },
			{ kind: zinc.InstructionKind.Grab },
			{ kind: zinc.InstructionKind.Access, n: 1 },
			{ kind: zinc.InstructionKind.Return },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Cur, addr: 9 },
			{ kind: zinc.InstructionKind.Access, n: 0 },
			{ kind: zinc.InstructionKind.Return },
			{ kind: zinc.InstructionKind.Apply },
		],
		{ addr: 2, env: list.empty, kind: zinc.ValueKind.Closure },
	],
	[
		app(app(abs(abs(v(1))), abs(v(0))), abs(v(0))),
		[
			{ kind: zinc.InstructionKind.Pushmark },
			{ kind: zinc.InstructionKind.Cur, addr: 4 },
			{ kind: zinc.InstructionKind.Access, n: 0 },
			{ kind: zinc.InstructionKind.Return },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Pushmark },
			{ kind: zinc.InstructionKind.Cur, addr: 9 },
			{ kind: zinc.InstructionKind.Access, n: 0 },
			{ kind: zinc.InstructionKind.Return },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Cur, addr: 14 },
			{ kind: zinc.InstructionKind.Grab },
			{ kind: zinc.InstructionKind.Access, n: 1 },
			{ kind: zinc.InstructionKind.Return },
			{ kind: zinc.InstructionKind.Apply },
			{ kind: zinc.InstructionKind.Apply },
		],
		{ addr: 7, env: list.empty, kind: zinc.ValueKind.Closure },
	],
	[
		app(abs(abs(v(1))), app(abs(abs(v(0))), abs(abs(v(0))))),
		[
			{ kind: zinc.InstructionKind.Pushmark },
			{ kind: zinc.InstructionKind.Pushmark },
			{ kind: zinc.InstructionKind.Cur, addr: 6 },
			{ kind: zinc.InstructionKind.Grab },
			{ kind: zinc.InstructionKind.Access, n: 0 },
			{ kind: zinc.InstructionKind.Return },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Cur, addr: 11 },
			{ kind: zinc.InstructionKind.Grab },
			{ kind: zinc.InstructionKind.Access, n: 0 },
			{ kind: zinc.InstructionKind.Return },
			{ kind: zinc.InstructionKind.Apply },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Cur, addr: 17 },
			{ kind: zinc.InstructionKind.Grab },
			{ kind: zinc.InstructionKind.Access, n: 1 },
			{ kind: zinc.InstructionKind.Return },
			{ kind: zinc.InstructionKind.Apply },
		],
		{
			addr: 15,
			env: list.cons(
				{
					addr: 9,
					env: list.cons({ addr: 3, env: list.empty, kind: zinc.ValueKind.Closure }, list.empty),
					kind: zinc.ValueKind.Closure,
				},
				list.empty,
			),
			kind: zinc.ValueKind.Closure,
		},
	],
	[
		app(abs(abs(v(1))), add(int(1), int(2))),
		[
			{ kind: zinc.InstructionKind.Pushmark },
			{ kind: zinc.InstructionKind.Int, value: 2 },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Int, value: 1 },
			{ kind: zinc.InstructionKind.Prim, op: zinc.PrimitiveOperation.Add },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Cur, addr: 10 },
			{ kind: zinc.InstructionKind.Grab },
			{ kind: zinc.InstructionKind.Access, n: 1 },
			{ kind: zinc.InstructionKind.Return },
			{ kind: zinc.InstructionKind.Apply },
		],
		{
			addr: 8,
			env: list.cons(
				{
					value: 3,
					kind: zinc.ValueKind.Int,
				},
				list.empty,
			),
			kind: zinc.ValueKind.Closure,
		},
	],
	[
		app(abs(abs(v(1))), abs(add(int(1), int(2)))),
		[
			{ kind: zinc.InstructionKind.Pushmark },
			{ kind: zinc.InstructionKind.Cur, addr: 7 },
			{ kind: zinc.InstructionKind.Int, value: 2 },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Int, value: 1 },
			{ kind: zinc.InstructionKind.Prim, op: zinc.PrimitiveOperation.Add },
			{ kind: zinc.InstructionKind.Return },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Cur, addr: 12 },
			{ kind: zinc.InstructionKind.Grab },
			{ kind: zinc.InstructionKind.Access, n: 1 },
			{ kind: zinc.InstructionKind.Return },
			{ kind: zinc.InstructionKind.Apply },
		],
		{
			addr: 10,
			env: list.cons({ addr: 2, env: list.empty, kind: zinc.ValueKind.Closure }, list.empty),
			kind: zinc.ValueKind.Closure,
		},
	],
	[
		app(abs(letIn(abs(v(2)), v(0), true)), int(7)),
		[
			{ kind: zinc.InstructionKind.Pushmark },
			{ kind: zinc.InstructionKind.Int, value: 7 },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Cur, addr: 11 },
			{ kind: zinc.InstructionKind.Dummy },
			{ kind: zinc.InstructionKind.Cur, addr: 8 },
			{ kind: zinc.InstructionKind.Access, n: 2 },
			{ kind: zinc.InstructionKind.Return },
			{ kind: zinc.InstructionKind.Update },
			{ kind: zinc.InstructionKind.Access, n: 0 },
			{ kind: zinc.InstructionKind.Return },
			{ kind: zinc.InstructionKind.Apply },
		],
		((): zinc.Value => {
			const closure: zinc.Closure = {
				addr: 6,
				env: list.empty,
				kind: zinc.ValueKind.Closure,
			};
			closure.env = list.cons({ kind: zinc.ValueKind.Int, value: 7 }, closure.env);
			closure.env = list.cons(closure, closure.env);
			return closure;
		})(),
	],
	[
		// let x = 1 in x + x
		letIn(int(1), add(v(0), v(0)), false),
		[
			{ kind: zinc.InstructionKind.Int, value: 1 },
			{ kind: zinc.InstructionKind.Let },
			{ kind: zinc.InstructionKind.Access, n: 0 },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Access, n: 0 },
			{ kind: zinc.InstructionKind.Prim, op: zinc.PrimitiveOperation.Add },
			{ kind: zinc.InstructionKind.Endlet },
		],
		{ kind: zinc.ValueKind.Int, value: 2 },
	],
	[
		// if 1 < 2 then 3 else 4
		ifElse(lt(int(1), int(2)), int(3), int(4)),
		[
			{ kind: zinc.InstructionKind.Int, value: 2 },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Int, value: 1 },
			{ kind: zinc.InstructionKind.Prim, op: zinc.PrimitiveOperation.Lt },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.BranchIfNot, addr: 8 },
			{ kind: zinc.InstructionKind.Int, value: 3 },
			{ kind: zinc.InstructionKind.Branch, addr: 9 },
			{ kind: zinc.InstructionKind.Int, value: 4 },
		],
		{ kind: zinc.ValueKind.Int, value: 3 },
	],
	[
		// (λx. if x then 1 else 2) false
		app(abs(ifElse(v(0), int(1), int(2))), bool(false)),
		[
			{ kind: zinc.InstructionKind.Pushmark },
			{ kind: zinc.InstructionKind.Bool, value: false },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Cur, addr: 11 },
			{ kind: zinc.InstructionKind.Access, n: 0 },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.BranchIfNot, addr: 9 },
			{ kind: zinc.InstructionKind.Int, value: 1 },
			{ kind: zinc.InstructionKind.Branch, addr: 10 },
			{ kind: zinc.InstructionKind.Int, value: 2 },
			{ kind: zinc.InstructionKind.Return },
			{ kind: zinc.InstructionKind.Apply },
		],
		{ kind: zinc.ValueKind.Int, value: 2 },
	],
	[
		// let rec f = λn. if n == 0 then 1 else n * f (n - 1) in f 3
		letIn(abs(ifElse(eq(v(0), int(0)), int(1), mul(v(0), app(v(1), sub(v(0), int(1)))))), app(v(0), int(3)), true),
		[
			{ kind: zinc.InstructionKind.Dummy },
			{ kind: zinc.InstructionKind.Cur, addr: 22 },
			{ kind: zinc.InstructionKind.Int, value: 0 },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Access, n: 0 },
			{ kind: zinc.InstructionKind.Prim, op: zinc.PrimitiveOperation.Eq },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.BranchIfNot, addr: 10 },
			{ kind: zinc.InstructionKind.Int, value: 1 },
			{ kind: zinc.InstructionKind.Branch, addr: 21 },
			{ kind: zinc.InstructionKind.Pushmark },
			{ kind: zinc.InstructionKind.Int, value: 1 },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Access, n: 0 },
			{ kind: zinc.InstructionKind.Prim, op: zinc.PrimitiveOperation.Sub },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Access, n: 1 },
			{ kind: zinc.InstructionKind.Apply },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Access, n: 0 },
			{ kind: zinc.InstructionKind.Prim, op: zinc.PrimitiveOperation.Mul },
			{ kind: zinc.InstructionKind.Return },
			{ kind: zinc.InstructionKind.Update },
			{ kind: zinc.InstructionKind.Pushmark },
			{ kind: zinc.InstructionKind.Int, value: 3 },
			{ kind: zinc.InstructionKind.Push },
			{ kind: zinc.InstructionKind.Access, n: 0 },
			{ kind: zinc.InstructionKind.Apply },
			{ kind: zinc.InstructionKind.Endlet },
		],
		{ kind: zinc.ValueKind.Int, value: 6 },
	],
];

suite("ZINC", () => {
	for (const [input, expected, value] of cases) {
		test(ast.toString(input), () => {
			const compiler = new zinc.Compiler();
			compiler.compile(input);
			const actual = compiler.getInstructions();
			deepStrictEqual(actual, expected);
			const machine = new zinc.Machine();
			machine.load(expected);
			for (let i = 0; i < 1000; i++) {
				if (!machine.step()) {
					break;
				}
			}
			deepStrictEqual(machine.readback(compiler.getReadback()), reduce.callByValue(input));
			// @ts-expect-error accessing protected variables
			deepStrictEqual(machine.acc, value);
		});
	}
});
