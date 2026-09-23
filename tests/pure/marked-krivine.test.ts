import { deepStrictEqual } from "node:assert";
import test, { suite } from "node:test";
import { ast, markedKrivine, reduce } from "../../src/pure";
import * as list from "../../src/utils/list";

const { variable: v, application: app, abstraction: abs } = ast;

const cases: [ast.Expression, markedKrivine.Instruction[], markedKrivine.Closure][] = [
	[
		app(abs(v(0)), abs(abs(v(1)))),
		[
			{ kind: markedKrivine.InstructionKind.Reduce, addr: 3 },
			{ kind: markedKrivine.InstructionKind.Grab },
			{ kind: markedKrivine.InstructionKind.Access, n: 0 },
			{ kind: markedKrivine.InstructionKind.Grab },
			{ kind: markedKrivine.InstructionKind.Grab },
			{ kind: markedKrivine.InstructionKind.Access, n: 1 },
		],
		{ addr: 3, env: list.empty, marked: false },
	],
	[
		app(app(abs(abs(v(1))), abs(v(0))), abs(v(0))),
		[
			{ kind: markedKrivine.InstructionKind.Reduce, addr: 7 },
			{ kind: markedKrivine.InstructionKind.Reduce, addr: 5 },
			{ kind: markedKrivine.InstructionKind.Grab },
			{ kind: markedKrivine.InstructionKind.Grab },
			{ kind: markedKrivine.InstructionKind.Access, n: 1 },
			{ kind: markedKrivine.InstructionKind.Grab },
			{ kind: markedKrivine.InstructionKind.Access, n: 0 },
			{ kind: markedKrivine.InstructionKind.Grab },
			{ kind: markedKrivine.InstructionKind.Access, n: 0 },
		],
		{ addr: 5, env: list.empty, marked: false },
	],
	[
		app(abs(abs(v(1))), app(abs(abs(v(0))), abs(abs(v(0))))),
		[
			{ kind: markedKrivine.InstructionKind.Reduce, addr: 4 },
			{ kind: markedKrivine.InstructionKind.Grab },
			{ kind: markedKrivine.InstructionKind.Grab },
			{ kind: markedKrivine.InstructionKind.Access, n: 1 },
			{ kind: markedKrivine.InstructionKind.Reduce, addr: 8 },
			{ kind: markedKrivine.InstructionKind.Grab },
			{ kind: markedKrivine.InstructionKind.Grab },
			{ kind: markedKrivine.InstructionKind.Access, n: 0 },
			{ kind: markedKrivine.InstructionKind.Grab },
			{ kind: markedKrivine.InstructionKind.Grab },
			{ kind: markedKrivine.InstructionKind.Access, n: 0 },
		],
		{
			addr: 2,
			env: list.cons(
				{ addr: 6, env: list.cons({ addr: 8, env: list.empty, marked: false }, list.empty), marked: false },
				list.empty,
			),
			marked: false,
		},
	],
];

suite("Krivine machine with marks on stack", () => {
	for (const [input, expected, closure] of cases) {
		test(ast.toString(input), () => {
			const compiler = new markedKrivine.Compiler(true);
			compiler.compile(input);
			const actual = compiler.getInstructions();
			deepStrictEqual(actual, expected);
			const machine = new markedKrivine.Machine();
			machine.load(expected);
			for (let i = 0; i < 1000; i++) {
				if (!machine.step()) {
					break;
				}
			}
			deepStrictEqual(machine.readback(compiler.getReadback()), reduce.callByValue(input));
			// @ts-expect-error accessing protected variables
			deepStrictEqual({ addr: machine.pc, env: machine.env, marked: false }, closure);
		});
	}
});
