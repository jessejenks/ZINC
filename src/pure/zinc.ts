import type { List } from "../utils/list";
import * as list from "../utils/list";
import * as ast from "./core";

export const enum InstructionKind {
	Access,
	Push,
	Pushmark,
	Apply,
	Appterm,
	Grab,
	Cur,
	Return,
}
export type Access = { kind: InstructionKind.Access; n: number };
export type Push = { kind: InstructionKind.Push };
export type Pushmark = { kind: InstructionKind.Pushmark };
export type Apply = { kind: InstructionKind.Apply };
export type Appterm = { kind: InstructionKind.Appterm };
export type Grab = { kind: InstructionKind.Grab };
export type Cur = { kind: InstructionKind.Cur; addr: number };
export type Return = { kind: InstructionKind.Return };
export type Instruction = Access | Push | Pushmark | Apply | Appterm | Grab | Cur | Return;

type Trace = {
	kind: "Trace";
	scheme: "C" | "T";
	expr: ast.Expression;
	start: number;
	end: number;
	children: (Instruction | Trace)[];
};

export class Compiler {
	protected instructions: Instruction[];
	protected readbackTable: Map<number, ast.Expression>;
	protected compilationTrace: Trace | null;

	constructor() {
		this.instructions = [];
		this.readbackTable = new Map();
		this.compilationTrace = null;
	}

	getInstructions(): readonly Instruction[] {
		return this.instructions;
	}

	getReadback(): ReadonlyMap<number, ast.Expression> {
		return this.readbackTable;
	}

	compile(expr: ast.Expression) {
		this.instructions.length = 0;
		this.readbackTable.clear();
		this.compilationTrace = null;
		this.compileExpr(expr);
	}

	protected enter(scheme: "C" | "T", expr: ast.Expression): Trace | null {
		const node: Trace = { kind: "Trace", scheme, expr, start: this.instructions.length, end: -1, children: [] };
		if (this.compilationTrace) {
			this.compilationTrace.children.push(node);
		}
		const parent = this.compilationTrace;
		this.compilationTrace = node;
		return parent;
	}

	protected emit(instr: Instruction) {
		this.instructions.push(instr);
		if (!this.compilationTrace) return;
		this.compilationTrace.children.push(instr);
	}

	protected exit(parent: Trace | null) {
		if (!this.compilationTrace) return;
		this.compilationTrace.end = this.instructions.length;
		if (!parent) return;
		this.compilationTrace = parent;
	}

	protected compileExpr(expr: ast.Expression): number {
		const parent = this.enter("C", expr);
		const addr = this.instructions.length;
		switch (expr.kind) {
			case ast.ExpressionKind.Variable:
				this.emit({ kind: InstructionKind.Access, n: expr.index });
				break;
			case ast.ExpressionKind.Application:
				this.emit({ kind: InstructionKind.Pushmark });
				this.compileExpr(expr.right);
				this.emit({ kind: InstructionKind.Push });
				this.compileExpr(expr.left);
				this.emit({ kind: InstructionKind.Apply });
				break;
			case ast.ExpressionKind.Abstraction:
				this.emit({ kind: InstructionKind.Cur, addr: -1 });
				this.readbackTable.set(this.instructions.length, expr);
				this.compileExprTail(expr.body);
				this.emit({ kind: InstructionKind.Return });
				(this.instructions[addr] as Cur).addr = this.instructions.length;
				break;
		}
		this.exit(parent);
		return addr;
	}

	protected compileExprTail(expr: ast.Expression): number {
		const parent = this.enter("T", expr);
		const addr = this.instructions.length;
		switch (expr.kind) {
			case ast.ExpressionKind.Variable:
				this.emit({ kind: InstructionKind.Access, n: expr.index });
				break;
			case ast.ExpressionKind.Application:
				this.compileExpr(expr.right);
				this.emit({ kind: InstructionKind.Push });
				this.compileExpr(expr.left);
				this.emit({ kind: InstructionKind.Appterm });
				break;
			case ast.ExpressionKind.Abstraction:
				this.emit({ kind: InstructionKind.Grab });
				this.readbackTable.set(this.instructions.length, expr);
				this.compileExprTail(expr.body);
				break;
		}
		this.exit(parent);
		return addr;
	}

	printCompilation() {
		if (!this.compilationTrace) {
			return;
		}
		printTrace(this.compilationTrace);
	}
}

function printTrace(root: Trace) {
	printTraceInner(root, []);
}

function printTraceInner(trace: Trace, prefix: string[]) {
	if (prefix.length === 0) {
		printTraceLine(prefix, trace);
	}
	let addr = trace.start;
	for (let i = 0; i < trace.children.length; i++) {
		const child = trace.children[i];
		const isLastChild = i == trace.children.length - 1;
		if (child.kind === "Trace") {
			prefix.push(isLastChild ? "└─ " : "├─ ");
			printTraceLine(prefix, child);
			prefix[prefix.length - 1] = isLastChild ? "   " : "│  ";
			printTraceInner(child, prefix);
			prefix.pop();
			addr = child.end;
		} else {
			prefix.push(isLastChild ? "└─ " : "├─ ");
			printTraceInstruction(addr++, prefix, child);
			prefix.pop();
		}
	}
}

function printTraceLine(prefix: string[], trace: Trace) {
	console.debug(`    ${prefix.join("")}${trace.scheme}[[ ${ast.toString(trace.expr)} ]]`);
}

function printTraceInstruction(address: number, prefix: string[], instruction: Instruction) {
	let rhs: string;
	switch (instruction.kind) {
		case InstructionKind.Access:
			rhs = `Access(${instruction.n})`;
			break;
		case InstructionKind.Push:
			rhs = `Push`;
			break;
		case InstructionKind.Pushmark:
			rhs = `Pushmark`;
			break;
		case InstructionKind.Apply:
			rhs = `Apply`;
			break;
		case InstructionKind.Appterm:
			rhs = `Appterm`;
			break;
		case InstructionKind.Grab:
			rhs = `Grab`;
			break;
		case InstructionKind.Cur:
			rhs = `Cur(${instruction.addr})`;
			break;
		case InstructionKind.Return:
			rhs = `Return`;
			break;
	}
	console.debug(`${formatInstructionAddress(address)} ${prefix.join("")}${rhs}`);
}

function formatInstructionAddress(n: number) {
	return n.toString().padStart(3, "0");
}

export type Closure = { isMark: false; addr: number; env: Environment };
export type Mark = { isMark: true };
export type Environment = List<Closure>;

const MARK: Mark = { isMark: true };

export class RuntimeError extends Error {
	constructor(readonly msg: string) {
		super(msg);
	}
}

function substitute(
	t: ast.Expression,
	env: Environment,
	depth: number,
	terms: ReadonlyMap<number, ast.Expression>,
): ast.Expression {
	switch (t.kind) {
		case ast.ExpressionKind.Variable: {
			if (t.index < depth) {
				return t;
			}
			let e = env;
			for (let i = depth; i < t.index; i++) {
				if (list.isEmpty(e)) {
					throw new RuntimeError(`Unexpected free variable ${t.index}`);
				}
				e = e.tail;
			}
			if (list.isEmpty(e)) {
				throw new RuntimeError(`Unexpected free variable ${t.index}`);
			}
			const term = terms.get(e.head.addr);
			if (!term) {
				throw new RuntimeError("Could not reconstruct expression");
			}
			return substitute(term, e.head.env, 0, terms);
		}
		case ast.ExpressionKind.Application:
			return ast.application(substitute(t.left, env, depth, terms), substitute(t.right, env, depth, terms));
		case ast.ExpressionKind.Abstraction:
			return ast.abstraction(substitute(t.body, env, depth + 1, terms));
	}
}

export function closureListToString(l: List<Closure | Mark>): string {
	const parts: string[] = [];
	closureListToStringInner(parts, l);
	return parts.join("");
}

function closureListToStringInner(builder: string[], l: List<Closure | Mark>) {
	builder.push("[");
	let i = 0;
	while (!list.isEmpty(l)) {
		if (i > 0) {
			builder.push(", ");
		}
		closureToStringInner(builder, l.head);
		l = l.tail;
		i++;
	}
	builder.push("]");
}

export function closureToString(c: Closure | Mark): string {
	const parts: string[] = [];
	closureToStringInner(parts, c);
	return parts.join("");
}

function closureToStringInner(builder: string[], c: Closure | Mark) {
	if (c.isMark) {
		builder.push("ε");
		return;
	}
	builder.push(`(${c.addr}, [`);
	let env = c.env;
	let i = 0;
	while (!list.isEmpty(env)) {
		if (i === 0) {
			builder.push(" ");
		} else {
			builder.push(", ");
		}
		closureToStringInner(builder, env.head);
		env = env.tail;
	}
	builder.push("])");
}

export class Machine {
	protected pc: number;
	protected instructions: readonly Instruction[];
	protected halted: boolean;
	protected acc: Closure;
	protected env: Environment;
	protected argStack: List<Closure | Mark>;
	protected retStack: List<Closure>;

	constructor() {
		this.pc = 0;
		this.instructions = [];
		this.halted = false;
		this.acc = { isMark: false, addr: -1, env: list.empty };
		this.env = list.empty;
		this.argStack = list.empty;
		this.retStack = list.empty;
	}

	load(instructions: readonly Instruction[]) {
		this.pc = 0;
		this.instructions = instructions;
		this.halted = false;
		this.acc.addr = -1;
		this.acc.env = list.empty;
		this.env = list.empty;
		this.argStack = list.empty;
		this.retStack = list.empty;
	}

	step(): boolean {
		if (this.halted) {
			return false;
		}
		if (this.pc >= this.instructions.length) {
			this.halted = true;
			return false;
		}
		const instr = this.instructions[this.pc];
		switch (instr.kind) {
			case InstructionKind.Access: {
				let env = this.env;
				let closure: Closure | null = null;
				for (let i = 0; i <= instr.n; i++) {
					if (list.isEmpty(env)) {
						this.halted = true;
						throw new RuntimeError(`Access(${instr.n}) failed`);
					}
					closure = env.head;
					env = env.tail;
				}
				if (closure === null) {
					this.halted = true;
					throw new RuntimeError(`Access(${instr.n}) failed`);
				}
				this.acc = closure;
				this.pc++;
				break;
			}
			case InstructionKind.Push:
				this.argStack = list.cons(this.acc, this.argStack);
				this.pc++;
				break;
			case InstructionKind.Pushmark:
				this.argStack = list.cons(MARK, this.argStack);
				this.pc++;
				break;
			case InstructionKind.Apply: {
				let arg: Closure | Mark;
				[arg, this.argStack] = list.pop(this.argStack);
				if (arg.isMark) {
					throw new RuntimeError("Expected an argument");
				}
				this.retStack = list.cons(
					{
						isMark: false,
						addr: ++this.pc,
						env: this.env,
					},
					this.retStack,
				);
				this.env = this.acc.env;
				this.env = list.cons(arg, this.env);
				this.pc = this.acc.addr;
				break;
			}
			case InstructionKind.Appterm: {
				let arg: Closure | Mark;
				[arg, this.argStack] = list.pop(this.argStack);
				if (arg.isMark) {
					throw new RuntimeError("Expected an argument");
				}
				this.env = this.acc.env;
				this.env = list.cons(arg, this.env);
				this.pc = this.acc.addr;
				break;
			}
			case InstructionKind.Grab: {
				let arg: Closure | Mark;
				[arg, this.argStack] = list.pop(this.argStack);
				if (arg.isMark) {
					let retValue: Closure;
					[retValue, this.retStack] = list.pop(this.retStack);
					this.acc = { isMark: false, addr: this.pc + 1, env: this.env };
					this.pc = retValue.addr;
					this.env = retValue.env;
				} else {
					this.env = list.cons(arg, this.env);
					this.pc++;
				}
				break;
			}
			case InstructionKind.Cur:
				this.acc = { isMark: false, addr: this.pc + 1, env: this.env };
				this.pc = instr.addr;
				break;
			case InstructionKind.Return: {
				let arg: Closure | Mark;
				[arg, this.argStack] = list.pop(this.argStack);
				if (arg.isMark) {
					let retValue: Closure;
					[retValue, this.retStack] = list.pop(this.retStack);
					this.pc = retValue.addr;
					this.env = retValue.env;
				} else {
					this.pc = this.acc.addr;
					this.env = this.acc.env;
					this.env = list.cons(arg, this.env);
				}
				break;
			}
		}
		return true;
	}

	debug() {
		console.debug(`pc: ${this.pc}`);
		console.debug("--- acc       ---");
		console.debug(closureToString(this.acc));
		console.debug("--- env       ---");
		console.debug(closureListToString(this.env));
		console.debug("--- arg stack ---");
		console.debug(closureListToString(this.argStack));
		console.debug("--- ret stack ---");
		console.debug(closureListToString(this.retStack));
	}

	readback(readbackTable: ReadonlyMap<number, ast.Expression>) {
		const term = readbackTable.get(this.acc.addr);
		if (!term) {
			throw new RuntimeError("Could not reconstruct expression");
		}
		return substitute(term, this.acc.env, 0, readbackTable);
	}
}
