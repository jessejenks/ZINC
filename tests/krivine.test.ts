import { deepStrictEqual } from "node:assert";
import test, { suite } from "node:test";
import { ast, krivine, reduce } from "../src";
import * as list from "../src/list";

const { variable: v, application: app, abstraction: abs } = ast;

const cases: [ast.Expression, krivine.Instruction[], krivine.Closure][] = [
	[
		app(abs(v(0)), abs(abs(v(1)))),
		[
			{ kind: krivine.InstructionKind.Push, addr: 3 },
			{ kind: krivine.InstructionKind.Grab },
			{ kind: krivine.InstructionKind.Access, n: 0 },
			{ kind: krivine.InstructionKind.Grab },
			{ kind: krivine.InstructionKind.Grab },
			{ kind: krivine.InstructionKind.Access, n: 1 },
		],
		{ addr: 3, env: list.empty },
	],
	[
		app(app(abs(abs(v(1))), abs(v(0))), abs(v(0))),
		[
			{ kind: krivine.InstructionKind.Push, addr: 7 },
			{ kind: krivine.InstructionKind.Push, addr: 5 },
			{ kind: krivine.InstructionKind.Grab },
			{ kind: krivine.InstructionKind.Grab },
			{ kind: krivine.InstructionKind.Access, n: 1 },
			{ kind: krivine.InstructionKind.Grab },
			{ kind: krivine.InstructionKind.Access, n: 0 },
			{ kind: krivine.InstructionKind.Grab },
			{ kind: krivine.InstructionKind.Access, n: 0 },
		],
		{ addr: 5, env: list.empty },
	],
	[
		app(abs(abs(v(1))), app(abs(abs(v(0))), abs(abs(v(0))))),
		[
			{ kind: krivine.InstructionKind.Push, addr: 4 },
			{ kind: krivine.InstructionKind.Grab },
			{ kind: krivine.InstructionKind.Grab },
			{ kind: krivine.InstructionKind.Access, n: 1 },
			{ kind: krivine.InstructionKind.Push, addr: 8 },
			{ kind: krivine.InstructionKind.Grab },
			{ kind: krivine.InstructionKind.Grab },
			{ kind: krivine.InstructionKind.Access, n: 0 },
			{ kind: krivine.InstructionKind.Grab },
			{ kind: krivine.InstructionKind.Grab },
			{ kind: krivine.InstructionKind.Access, n: 0 },
		],
		{ addr: 2, env: list.cons({ addr: 4, env: list.empty }, list.empty) },
	],
];

suite("Krivine machine", () => {
	for (const [input, expected, closure] of cases) {
		test(ast.toString(input), () => {
			const compiler = new krivine.Compiler();
			compiler.compile(input);
			const actual = compiler.getInstructions();
			deepStrictEqual(actual, expected);
			const machine = new krivine.Machine();
			machine.load(expected);
			for (let i = 0; i < 1000; i++) {
				if (!machine.step()) {
					break;
				}
			}
			deepStrictEqual(machine.readback(compiler.getReadback()), reduce.callByName(input));
			// @ts-expect-error accessing protected variables
			deepStrictEqual({ addr: machine.pc, env: machine.env }, closure);
		});
	}
});
