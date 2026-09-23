import { deepStrictEqual } from "node:assert";
import test, { suite } from "node:test";
import { ast, reduce, zinc } from "../src";
import * as list from "../src/list";

const { variable: v, application: app, abstraction: abs } = ast;

const cases: [ast.Expression, zinc.Instruction[], zinc.Closure][] = [
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
		{ addr: 2, env: list.empty, isMark: false },
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
		{ addr: 7, env: list.empty, isMark: false },
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
					env: list.cons({ addr: 3, env: list.empty, isMark: false }, list.empty),
					isMark: false,
				},
				list.empty,
			),
			isMark: false,
		},
	],
];

suite("ZINC", () => {
	for (const [input, expected, closure] of cases) {
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
			deepStrictEqual(machine.acc, closure);
		});
	}
});
