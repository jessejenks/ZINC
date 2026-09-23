import type { List } from "../utils/list";
import * as list from "../utils/list";
import * as ast from "./core";

export const enum InstructionKind {
	Access,
	Push,
	Grab,
}

export type Access = { kind: InstructionKind.Access; n: number };
export type Push = { kind: InstructionKind.Push; addr: number };
export type Grab = { kind: InstructionKind.Grab };
export type Instruction = Access | Push | Grab;

export class Compiler {
	protected instructions: Instruction[];
	protected readbackTable: ast.Expression[];

	constructor() {
		this.instructions = [];
		this.readbackTable = [];
	}

	getInstructions(): readonly Instruction[] {
		return this.instructions;
	}

	getReadback(): readonly ast.Expression[] {
		return this.readbackTable;
	}

	compile(expr: ast.Expression) {
		this.instructions.length = 0;
		this.readbackTable.length = 0;
		this.compileExpr(expr);
	}

	protected compileExpr(expr: ast.Expression): number {
		const addr = this.instructions.length;
		this.readbackTable.push(expr);
		switch (expr.kind) {
			case ast.ExpressionKind.Variable:
				this.instructions.push({ kind: InstructionKind.Access, n: expr.index });
				break;
			case ast.ExpressionKind.Application:
				this.instructions.push({ kind: InstructionKind.Push, addr: -1 });
				this.compileExpr(expr.left);
				const addrRight = this.compileExpr(expr.right);
				(this.instructions[addr] as Push).addr = addrRight;
				break;
			case ast.ExpressionKind.Abstraction:
				this.instructions.push({ kind: InstructionKind.Grab });
				this.compileExpr(expr.body);
				break;
		}
		return addr;
	}

	printCompilation() {
		for (let i = 0; i < this.readbackTable.length; i++) {
			const expr = this.readbackTable[i];
			const instr = this.instructions[i];
			switch (instr.kind) {
				case InstructionKind.Access:
					console.debug(
						i.toString().padStart(3, "0"),
						`Access(${instr.n})`.padEnd(12),
						"<-",
						`[[ ${ast.toString(expr)} ]]`,
					);
					break;
				case InstructionKind.Push:
					console.debug(
						i.toString().padStart(3, "0"),
						`Push(${instr.addr})`.padEnd(12),
						"<-",
						`[[ ${ast.toString(expr)} ]]`,
					);
					break;
				case InstructionKind.Grab:
					console.debug(i.toString().padStart(3, "0"), `Grab`.padEnd(12), "<-", `[[ ${ast.toString(expr)} ]]`);
					break;
			}
		}
	}
}

export type Closure = { addr: number; env: Environment };
export type Environment = List<Closure>;

export class RuntimeError extends Error {
	constructor(readonly msg: string) {
		super(msg);
	}
}

function substitute(
	t: ast.Expression,
	env: Environment,
	depth: number,
	terms: readonly ast.Expression[],
): ast.Expression {
	switch (t.kind) {
		case ast.ExpressionKind.Variable: {
			if (t.index < depth) {
				return t;
			}
			let e = env;
			for (let i = depth; i < t.index; i++) {
				if (list.isEmpty(e)) {
					throw new RuntimeError(`free variable ${t.index}`);
				}
				e = e.tail;
			}
			if (list.isEmpty(e)) {
				throw new RuntimeError(`free variable ${t.index}`);
			}
			return substitute(terms[e.head.addr], e.head.env, 0, terms);
		}
		case ast.ExpressionKind.Application:
			return ast.application(substitute(t.left, env, depth, terms), substitute(t.right, env, depth, terms));
		case ast.ExpressionKind.Abstraction:
			return ast.abstraction(substitute(t.body, env, depth + 1, terms));
	}
}

export function closureListToString(l: List<Closure>): string {
	const parts: string[] = [];
	closureListToStringInner(parts, l);
	return parts.join("");
}

function closureListToStringInner(builder: string[], l: List<Closure>) {
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

export function closureToString(c: Closure): string {
	const parts: string[] = [];
	closureToStringInner(parts, c);
	return parts.join("");
}

function closureToStringInner(builder: string[], c: Closure) {
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
	protected env: Environment;
	protected stack: List<Closure>;

	constructor() {
		this.pc = 0;
		this.instructions = [];
		this.halted = false;
		this.env = list.empty;
		this.stack = list.empty;
	}

	load(instructions: readonly Instruction[]) {
		this.pc = 0;
		this.instructions = instructions;
		this.halted = false;
		this.env = list.empty;
		this.stack = list.empty;
	}

	step(): boolean {
		if (this.halted) {
			return false;
		}
		if (this.pc >= this.instructions.length) {
			throw new RuntimeError("out of bounds");
		}
		const instr = this.instructions[this.pc];
		switch (instr.kind) {
			case InstructionKind.Access: {
				let closure: Closure | null = null;
				for (let i = 0; i <= instr.n; i++) {
					if (list.isEmpty(this.env)) {
						this.halted = true;
						throw new RuntimeError(`Access(${instr.n}) failed`);
					}
					closure = this.env.head;
					this.env = this.env.tail;
				}
				if (closure === null) {
					this.halted = true;
					throw new RuntimeError(`Access(${instr.n}) failed`);
				}
				this.pc = closure.addr;
				this.env = closure.env;
				return true;
			}
			case InstructionKind.Push:
				this.stack = list.cons({ addr: instr.addr, env: this.env }, this.stack);
				this.pc++;
				return true;
			case InstructionKind.Grab: {
				if (list.isEmpty(this.stack)) {
					this.halted = true;
					return false;
				}
				let closure: Closure;
				[closure, this.stack] = list.pop(this.stack);
				this.env = list.cons(closure, this.env);
				this.pc++;
				return true;
			}
		}
	}

	debug() {
		console.debug(`pc: ${this.pc}`);
		console.debug("--- env    ---");
		console.debug(closureListToString(this.env));
		console.debug("--- stack  ---");
		console.debug(closureListToString(this.stack));
	}

	readback(table: readonly ast.Expression[]) {
		return substitute(table[this.pc], this.env, 0, table);
	}
}
