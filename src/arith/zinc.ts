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
	Unit,
	Int,
	Prim,
}
export type Access = { kind: InstructionKind.Access; n: number };
export type Push = { kind: InstructionKind.Push };
export type Pushmark = { kind: InstructionKind.Pushmark };
export type Apply = { kind: InstructionKind.Apply };
export type Appterm = { kind: InstructionKind.Appterm };
export type Grab = { kind: InstructionKind.Grab };
export type Cur = { kind: InstructionKind.Cur; addr: number };
export type Return = { kind: InstructionKind.Return };
export type Unit = { kind: InstructionKind.Unit };
export type Int = { kind: InstructionKind.Int; value: number };
export type Prim = { kind: InstructionKind.Prim; op: PrimitiveOperation };
export type Instruction = Access | Push | Pushmark | Apply | Appterm | Grab | Cur | Return | Unit | Int | Prim;

export const enum PrimitiveOperation {
	Negate,
	Add,
	Sub,
	Mul,
}

function primitiveOpToString(op: PrimitiveOperation): string {
	switch (op) {
		case PrimitiveOperation.Negate:
			return "negate";
		case PrimitiveOperation.Add:
			return "add";
		case PrimitiveOperation.Sub:
			return "sub";
		case PrimitiveOperation.Mul:
			return "mul";
	}
}

const UNARY_TO_PRIM: Record<ast.UnaryOp, PrimitiveOperation> = {
	[ast.UnaryOp.Negate]: PrimitiveOperation.Negate,
};

const BINARY_TO_PRIM: Record<ast.BinaryOp, PrimitiveOperation> = {
	[ast.BinaryOp.Add]: PrimitiveOperation.Add,
	[ast.BinaryOp.Sub]: PrimitiveOperation.Sub,
	[ast.BinaryOp.Mul]: PrimitiveOperation.Mul,
};

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
			default:
				this.compilePrimitive(expr);
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
			default:
				this.compilePrimitive(expr);
		}
		this.exit(parent);
		return addr;
	}

	protected compilePrimitive(expr: ast.Unit | ast.Int | ast.Unary | ast.Binary) {
		switch (expr.kind) {
			case ast.ExpressionKind.Unit:
				this.emit({ kind: InstructionKind.Unit });
				break;
			case ast.ExpressionKind.Int:
				this.emit({ kind: InstructionKind.Int, value: expr.value });
				break;
			case ast.ExpressionKind.Unary:
				this.compileExpr(expr.expr);
				this.emit({ kind: InstructionKind.Prim, op: UNARY_TO_PRIM[expr.op] });
				break;
			case ast.ExpressionKind.Binary:
				this.compileExpr(expr.right);
				this.emit({ kind: InstructionKind.Push });
				this.compileExpr(expr.left);
				this.emit({ kind: InstructionKind.Prim, op: BINARY_TO_PRIM[expr.op] });
				break;
			default:
				expr satisfies never;
		}
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
		case InstructionKind.Unit:
			rhs = `unit`;
			break;
		case InstructionKind.Int:
			rhs = `(int ${instruction.value})`;
			break;
		case InstructionKind.Prim:
			rhs = `Prim(${primitiveOpToString(instruction.op)})`;
			break;
	}
	console.debug(`${formatInstructionAddress(address)} ${prefix.join("")}${rhs}`);
}

function formatInstructionAddress(n: number) {
	return n.toString().padStart(3, "0");
}

export const enum ValueKind {
	Unit,
	Int,
	Closure,
}
export type UnitValue = { kind: ValueKind.Unit; isMark?: undefined };
export type IntValue = { kind: ValueKind.Int; value: number; isMark?: undefined };
export type Closure = { kind: ValueKind.Closure; addr: number; env: Environment; isMark?: undefined };
export type Value = UnitValue | IntValue | Closure;
export type Mark = { isMark: true };
export type Environment = List<Value>;

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
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Int:
			return t;
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
			if (e.head.kind === ValueKind.Unit) {
				return ast.unit();
			}
			if (e.head.kind === ValueKind.Int) {
				return ast.int(e.head.value);
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
		case ast.ExpressionKind.Unary:
			return ast.unary(t.op, substitute(t.expr, env, depth, terms));
		case ast.ExpressionKind.Binary:
			return ast.binary(t.op, substitute(t.left, env, depth, terms), substitute(t.right, env, depth, terms));
	}
}

export function valueListToString(l: List<Value | Mark>): string {
	const parts: string[] = [];
	valueListToStringInner(parts, l);
	return parts.join("");
}

function valueListToStringInner(builder: string[], l: List<Value | Mark>) {
	builder.push("[");
	let i = 0;
	while (!list.isEmpty(l)) {
		if (i > 0) {
			builder.push(", ");
		}
		valueToStringInner(builder, l.head);
		l = l.tail;
		i++;
	}
	builder.push("]");
}

export function valueToString(value: Value | Mark): string {
	const parts: string[] = [];
	valueToStringInner(parts, value);
	return parts.join("");
}

function valueToStringInner(builder: string[], value: Value | Mark) {
	if (value.isMark) {
		builder.push("ε");
		return;
	}
	switch (value.kind) {
		case ValueKind.Unit:
			builder.push("unit");
			break;
		case ValueKind.Int:
			builder.push(`(int ${value.value})`);
			break;
		case ValueKind.Closure:
			closureToStringInner(builder, value);
			break;
	}
}

function closureToStringInner(builder: string[], c: Closure) {
	builder.push(`(${c.addr}, [`);
	let env = c.env;
	let i = 0;
	while (!list.isEmpty(env)) {
		if (i > 0) {
			builder.push(", ");
		}
		valueToStringInner(builder, env.head);
		env = env.tail;
		i++;
	}
	builder.push("])");
}

export class Machine {
	protected pc: number;
	protected instructions: readonly Instruction[];
	protected halted: boolean;
	protected acc: Value;
	protected env: Environment;
	protected argStack: List<Value | Mark>;
	protected retStack: List<Closure>;

	constructor() {
		this.pc = 0;
		this.instructions = [];
		this.halted = false;
		this.acc = { kind: ValueKind.Unit };
		this.env = list.empty;
		this.argStack = list.empty;
		this.retStack = list.empty;
	}

	load(instructions: readonly Instruction[]) {
		this.pc = 0;
		this.instructions = instructions;
		this.halted = false;
		this.acc = { kind: ValueKind.Unit };
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
				let value: Value | null = null;
				for (let i = 0; i <= instr.n; i++) {
					if (list.isEmpty(env)) {
						this.halted = true;
						throw new RuntimeError(`Access(${instr.n}) failed`);
					}
					value = env.head;
					env = env.tail;
				}
				if (value === null) {
					this.halted = true;
					throw new RuntimeError(`Access(${instr.n}) failed`);
				}
				this.acc = value;
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
				let arg: Value | Mark;
				[arg, this.argStack] = list.pop(this.argStack);
				if (arg.isMark) {
					throw new RuntimeError("Expected an argument");
				}
				this.retStack = list.cons(
					{
						kind: ValueKind.Closure,
						addr: ++this.pc,
						env: this.env,
					},
					this.retStack,
				);
				if (this.acc.kind !== ValueKind.Closure) {
					throw new RuntimeError("Expected a closure");
				}
				this.env = this.acc.env;
				this.env = list.cons(arg, this.env);
				this.pc = this.acc.addr;
				break;
			}
			case InstructionKind.Appterm: {
				let arg: Value | Mark;
				[arg, this.argStack] = list.pop(this.argStack);
				if (arg.isMark) {
					throw new RuntimeError("Expected an argument");
				}
				if (this.acc.kind !== ValueKind.Closure) {
					throw new RuntimeError("Expected a closure");
				}
				this.env = this.acc.env;
				this.env = list.cons(arg, this.env);
				this.pc = this.acc.addr;
				break;
			}
			case InstructionKind.Grab: {
				let arg: Value | Mark;
				[arg, this.argStack] = list.pop(this.argStack);
				if (arg.isMark) {
					let retValue: Closure;
					[retValue, this.retStack] = list.pop(this.retStack);
					this.acc = { kind: ValueKind.Closure, addr: this.pc + 1, env: this.env };
					this.pc = retValue.addr;
					this.env = retValue.env;
				} else {
					this.env = list.cons(arg, this.env);
					this.pc++;
				}
				break;
			}
			case InstructionKind.Cur:
				this.acc = { kind: ValueKind.Closure, addr: this.pc + 1, env: this.env };
				this.pc = instr.addr;
				break;
			case InstructionKind.Return: {
				let arg: Value | Mark;
				[arg, this.argStack] = list.pop(this.argStack);
				if (arg.isMark) {
					let retValue: Closure;
					[retValue, this.retStack] = list.pop(this.retStack);
					this.pc = retValue.addr;
					this.env = retValue.env;
				} else {
					if (this.acc.kind !== ValueKind.Closure) {
						throw new RuntimeError("Cannot return to non-closure");
					}
					this.pc = this.acc.addr;
					this.env = this.acc.env;
					this.env = list.cons(arg, this.env);
				}
				break;
			}
			case InstructionKind.Unit:
				this.pc++;
				this.acc = { kind: ValueKind.Unit };
				break;
			case InstructionKind.Int:
				this.pc++;
				this.acc = { kind: ValueKind.Int, value: instr.value };
				break;
			case InstructionKind.Prim:
				this.pc++;
				this.stepPrimitive(instr);
				break;
		}
		return true;
	}

	protected stepPrimitive(instr: Prim) {
		const left = this.acc;
		switch (instr.op) {
			case PrimitiveOperation.Negate:
				if (left.kind !== ValueKind.Int) {
					throw new RuntimeError("Cannot negate non-int");
				}
				this.acc = { kind: ValueKind.Int, value: -left.value };
				return;
		}
		let right: Value | Mark;
		[right, this.argStack] = list.pop(this.argStack);
		switch (instr.op) {
			case PrimitiveOperation.Add: {
				if (left.kind !== ValueKind.Int) {
					throw new RuntimeError("Cannot add non-int");
				}
				if (right.isMark || right.kind !== ValueKind.Int) {
					throw new RuntimeError("Cannot add non-int");
				}
				this.acc = { kind: ValueKind.Int, value: left.value + right.value };
				return;
			}
			case PrimitiveOperation.Sub: {
				if (left.kind !== ValueKind.Int) {
					throw new RuntimeError("Cannot subtract non-int");
				}
				if (right.isMark || right.kind !== ValueKind.Int) {
					throw new RuntimeError("Cannot subtract non-int");
				}
				this.acc = { kind: ValueKind.Int, value: left.value - right.value };
				return;
			}
			case PrimitiveOperation.Mul: {
				if (left.kind !== ValueKind.Int) {
					throw new RuntimeError("Cannot multiply non-int");
				}
				if (right.isMark || right.kind !== ValueKind.Int) {
					throw new RuntimeError("Cannot multiply non-int");
				}
				this.acc = { kind: ValueKind.Int, value: left.value * right.value };
				return;
			}
		}
	}

	debug() {
		console.debug(`pc: ${this.pc}`);
		console.debug("--- acc       ---");
		console.debug(valueToString(this.acc));
		console.debug("--- env       ---");
		console.debug(valueListToString(this.env));
		console.debug("--- arg stack ---");
		console.debug(valueListToString(this.argStack));
		console.debug("--- ret stack ---");
		console.debug(valueListToString(this.retStack));
	}

	readback(readbackTable: ReadonlyMap<number, ast.Expression>) {
		if (this.acc.kind === ValueKind.Unit) {
			return ast.unit();
		}
		if (this.acc.kind === ValueKind.Int) {
			return ast.int(this.acc.value);
		}
		const term = readbackTable.get(this.acc.addr);
		if (!term) {
			throw new RuntimeError("Could not reconstruct expression");
		}
		return substitute(term, this.acc.env, 0, readbackTable);
	}
}
