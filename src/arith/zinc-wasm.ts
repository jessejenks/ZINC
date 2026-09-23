import * as w from "../utils/wasm/wasm";
import * as ast from "./core";

const LIST = w.typeIdx(0);
const MAIN = w.typeIdx(1);
const FN_TP = w.typeIdx(2);
const CLOSURE_TP = w.typeIdx(3);
const UNIT_TP = w.typeIdx(4);
const ARGS = w.globalIdx(0);
const UNIT = w.globalIdx(1);
const ENV = w.localIdx(0);
const ACC_CLOSURE = w.localIdx(1);
const ACC_VALUE = w.localIdx(2);
const HEAD = w.fieldIdx(0);
const TAIL = w.fieldIdx(1);
const CL_CODE = w.fieldIdx(0);
const CL_ENV = w.fieldIdx(1);

function initializeModule() {
	const m = w.module();
	// List
	w.addType(
		m,
		w.structType([
			w.field(w.valAsStorage(w.refAsVal(w.anyref))),
			w.field(w.valAsStorage(w.refAsVal(w.refNull(w.typeAsHeap(LIST))))),
		]),
	);
	// Main
	w.addType(m, w.funcType([], [w.refAsVal(w.anyref)]));
	// Fn
	w.addType(m, w.funcType([w.refAsVal(w.refNull(w.typeAsHeap(LIST)))], [w.refAsVal(w.anyref)]));
	// Closure
	w.addType(
		m,
		w.structType([
			w.field(w.valAsStorage(w.refAsVal(w.ref(w.typeAsHeap(FN_TP))))),
			w.field(w.valAsStorage(w.refAsVal(w.refNull(w.typeAsHeap(LIST))))),
		]),
	);
	// Unit
	w.addType(m, w.structType([]));
	// Argument stack
	w.addGlobal(m, {
		type: w.refAsVal(w.refNull(w.typeAsHeap(LIST))),
		mutable: true,
		init: [{ op: w.Op.RefNull, heap: w.typeAsHeap(LIST) }],
	});
	// Unit (value)
	w.addGlobal(m, {
		type: w.refAsVal(w.ref(w.typeAsHeap(UNIT_TP))),
		mutable: false,
		init: [{ op: w.Op.StructNew, type: UNIT_TP }],
	});
	return m;
}

function access(instrs: w.Instr[], n: number) {
	instrs.push({ op: w.Op.LocalGet, index: ENV });
	for (let i = 0; i < n; i++) {
		instrs.push({ op: w.Op.StructGet, type: LIST, field: TAIL });
	}
	instrs.push({ op: w.Op.StructGet, type: LIST, field: HEAD });
}

function push(instrs: w.Instr[]) {
	instrs.push(
		{ op: w.Op.GlobalGet, index: ARGS },
		{ op: w.Op.StructNew, type: LIST },
		{ op: w.Op.GlobalSet, index: ARGS },
	);
}

function pushmark(instrs: w.Instr[]) {
	instrs.push(
		{ op: w.Op.RefNull, heap: w.absAsHeap(w.AbsHeapType.Any) },
		{ op: w.Op.GlobalGet, index: ARGS },
		{ op: w.Op.StructNew, type: LIST },
		{ op: w.Op.GlobalSet, index: ARGS },
	);
}

function apply(instrs: w.Instr[]) {
	instrs.push(
		{ op: w.Op.RefCast, type: w.ref(w.typeAsHeap(CLOSURE_TP)) },
		{ op: w.Op.LocalSet, index: ACC_CLOSURE },
		// env = cons(arg, closure.env)
		{ op: w.Op.GlobalGet, index: ARGS },
		{ op: w.Op.StructGet, type: LIST, field: HEAD },
		{ op: w.Op.LocalGet, index: ACC_CLOSURE },
		{ op: w.Op.StructGet, type: CLOSURE_TP, field: CL_ENV },
		{ op: w.Op.StructNew, type: LIST },
	);
	popArgs(instrs);
	instrs.push(
		{ op: w.Op.LocalGet, index: ACC_CLOSURE },
		{ op: w.Op.StructGet, type: CLOSURE_TP, field: CL_CODE },
		{ op: w.Op.CallRef, type: FN_TP },
	);
}

function appterm(instrs: w.Instr[]) {
	instrs.push(
		{ op: w.Op.RefCast, type: w.ref(w.typeAsHeap(CLOSURE_TP)) },
		{ op: w.Op.LocalSet, index: ACC_CLOSURE },
		// env = cons(arg, closure.env)
		{ op: w.Op.GlobalGet, index: ARGS },
		{ op: w.Op.StructGet, type: LIST, field: HEAD },
		{ op: w.Op.LocalGet, index: ACC_CLOSURE },
		{ op: w.Op.StructGet, type: CLOSURE_TP, field: CL_ENV },
		{ op: w.Op.StructNew, type: LIST },
	);
	popArgs(instrs);
	instrs.push(
		{ op: w.Op.LocalGet, index: ACC_CLOSURE },
		{ op: w.Op.StructGet, type: CLOSURE_TP, field: CL_CODE },
		{ op: w.Op.ReturnCallRef, type: FN_TP },
	);
}

function grab(instrs: w.Instr[], func: w.FuncIdx) {
	peekArgsForMark(instrs);
	const then: w.Instr[] = [];
	instrs.push({ op: w.Op.If, blockType: { kind: w.BlockKind.Empty }, label: new w.Label(), then, else: [] });
	popArgs(then);
	then.push(
		{ op: w.Op.RefFunc, func },
		{ op: w.Op.LocalGet, index: ENV },
		{ op: w.Op.StructNew, type: CLOSURE_TP },
		{ op: w.Op.Return },
	);

	envCons(instrs);
	popArgs(instrs);
	instrs.push({ op: w.Op.ReturnCall, func });
}

function cur(instrs: w.Instr[], func: w.FuncIdx) {
	instrs.push(
		{ op: w.Op.RefFunc, func },
		{ op: w.Op.LocalGet, index: ENV },
		{ op: w.Op.StructNew, type: CLOSURE_TP }, //
	);
}

function ret(instrs: w.Instr[]) {
	instrs.push({ op: w.Op.LocalSet, index: ACC_VALUE });
	peekArgsForMark(instrs);
	const then: w.Instr[] = [];
	instrs.push({ op: w.Op.If, blockType: { kind: w.BlockKind.Empty }, label: new w.Label(), then, else: [] });
	popArgs(then);
	then.push({ op: w.Op.LocalGet, index: ACC_VALUE }, { op: w.Op.Return });

	instrs.push({ op: w.Op.LocalGet, index: ACC_VALUE });
	appterm(instrs);
}

/** env = list.cons(arg, env) */
function envCons(instrs: w.Instr[]) {
	instrs.push(
		{ op: w.Op.GlobalGet, index: ARGS },
		{ op: w.Op.StructGet, type: LIST, field: HEAD },
		{ op: w.Op.LocalGet, index: ENV },
		{ op: w.Op.StructNew, type: LIST },
	);
}

/** args.peek() ==  mark ? */
function peekArgsForMark(instrs: w.Instr[]) {
	instrs.push(
		{ op: w.Op.GlobalGet, index: ARGS },
		{ op: w.Op.StructGet, type: LIST, field: HEAD },
		{ op: w.Op.RefIsNull },
	);
}

/** args.pop() */
function popArgs(instrs: w.Instr[]) {
	instrs.push(
		{ op: w.Op.GlobalGet, index: ARGS },
		{ op: w.Op.StructGet, type: LIST, field: TAIL },
		{ op: w.Op.GlobalSet, index: ARGS },
	);
}

function box(instrs: w.Instr[]) {
	instrs.push({ op: w.Op.RefI31 });
}

function unbox(instrs: w.Instr[]) {
	instrs.push({ op: w.Op.RefCast, type: w.i31ref }, { op: w.Op.I31GetS });
}

function makeFunc(body: w.Instr[]): w.Func {
	return {
		type: FN_TP,
		locals: [w.refAsVal(w.refNull(w.typeAsHeap(CLOSURE_TP))), w.refAsVal(w.anyref)],
		body,
	};
}

function makeMain(body: w.Instr[]): w.Func {
	// main has no env parameter, so local 0 is declared explicitly and starts null
	return {
		type: MAIN,
		locals: [
			w.refAsVal(w.refNull(w.typeAsHeap(LIST))),
			w.refAsVal(w.refNull(w.typeAsHeap(CLOSURE_TP))),
			w.refAsVal(w.anyref),
		],
		body,
	};
}

export class Compiler {
	protected module: w.Module;
	protected currBody: w.Instr[];

	constructor() {
		this.module = w.module();
		this.currBody = [];
	}

	getModule(): w.Module {
		return this.module;
	}

	compile(expr: ast.Expression) {
		this.currBody.length = 0;
		this.module = initializeModule();
		this.compileExpr(expr);
		w.declareFuncs(this.module);
		const main = w.addFunc(this.module, makeMain(this.currBody));
		w.addFuncExport(this.module, "main", main);
	}

	protected compileExpr(expr: ast.Expression) {
		switch (expr.kind) {
			case ast.ExpressionKind.Variable:
				access(this.currBody, expr.index);
				break;
			case ast.ExpressionKind.Application:
				pushmark(this.currBody);
				this.compileExpr(expr.right);
				push(this.currBody);
				this.compileExpr(expr.left);
				apply(this.currBody);
				break;
			case ast.ExpressionKind.Abstraction: {
				const outer = this.currBody;
				this.currBody = [];
				const funcidx = w.addFunc(this.module, makeFunc(this.currBody));
				cur(outer, funcidx);
				this.compileExprTail(expr.body);
				ret(this.currBody);
				this.currBody = outer;
				break;
			}
			default:
				this.compilePrimitive(expr);
		}
	}

	protected compileExprTail(expr: ast.Expression) {
		switch (expr.kind) {
			case ast.ExpressionKind.Variable:
				access(this.currBody, expr.index);
				break;
			case ast.ExpressionKind.Application:
				this.compileExpr(expr.right);
				push(this.currBody);
				this.compileExpr(expr.left);
				appterm(this.currBody);
				break;
			case ast.ExpressionKind.Abstraction: {
				const outer = this.currBody;
				this.currBody = [];
				const funcidx = w.addFunc(this.module, makeFunc(this.currBody));
				grab(outer, funcidx);
				this.compileExprTail(expr.body);
				ret(this.currBody);
				this.currBody = outer;
				break;
			}
			default:
				this.compilePrimitive(expr);
		}
	}

	protected compilePrimitive(expr: ast.Unit | ast.Int | ast.Negate | ast.Add | ast.Sub | ast.Mul) {
		switch (expr.kind) {
			case ast.ExpressionKind.Unit:
				this.currBody.push({ op: w.Op.GlobalGet, index: UNIT });
				break;
			case ast.ExpressionKind.Int:
				this.currBody.push({ op: w.Op.I32Const, value: expr.value });
				box(this.currBody);
				break;
			case ast.ExpressionKind.Negate:
				this.currBody.push({ op: w.Op.I32Const, value: 0 });
				this.compileExpr(expr.expr);
				unbox(this.currBody);
				this.currBody.push({ op: w.Op.I32SUB });
				box(this.currBody);
				break;
			case ast.ExpressionKind.Add:
				this.compileExpr(expr.left);
				unbox(this.currBody);
				this.compileExpr(expr.right);
				unbox(this.currBody);
				this.currBody.push({ op: w.Op.I32ADD });
				box(this.currBody);
				break;
			case ast.ExpressionKind.Sub:
				this.compileExpr(expr.left);
				unbox(this.currBody);
				this.compileExpr(expr.right);
				unbox(this.currBody);
				this.currBody.push({ op: w.Op.I32SUB });
				box(this.currBody);
				break;
			case ast.ExpressionKind.Mul:
				this.compileExpr(expr.left);
				unbox(this.currBody);
				this.compileExpr(expr.right);
				unbox(this.currBody);
				this.currBody.push({ op: w.Op.I32MUL });
				box(this.currBody);
				break;
		}
	}
}
