import {
	concat,
	holePrinter,
	Piece,
	piece,
	Plug,
	plugAll,
	Printer,
	renderDerivation,
	RenderOptions,
	Step,
	stringWriter,
	Writer,
} from "../utils/render";
import * as ast from "./core";
import type { Binder, Names } from "./names";
import { copyName, freshName, namesThrough } from "./names";
import type { BetaDerivation, DeltaDerivation, Derivation } from "./reduce";
import { DerivationRule } from "./reduce";

export type PrunedDerivation =
	| BetaDerivation
	| DeltaDerivation
	| {
			rule: DerivationRule.Nu | DerivationRule.Mu;
			before: ast.Application;
			after: ast.Application;
			child: PrunedDerivation;
	  }
	| {
			rule: DerivationRule.Xi;
			before: ast.Abstraction;
			after: ast.Abstraction;
			child: PrunedDerivation;
	  }
	| {
			rule: DerivationRule.Unary;
			before: ast.Unary;
			after: ast.Unary;
			child: PrunedDerivation;
	  }
	| {
			rule: DerivationRule.Binary;
			before: ast.Binary;
			after: ast.Binary;
			children: PrunedDerivation[];
	  }
	| {
			rule: DerivationRule.Seq;
			before: ast.Expression;
			after: ast.Expression;
			children: PrunedDerivation[];
	  };

export function pruneDerivation(derivation: Derivation): PrunedDerivation | null {
	switch (derivation.rule) {
		case DerivationRule.Id:
			return null;
		case DerivationRule.Beta:
		case DerivationRule.Delta:
			return derivation;
		case DerivationRule.Nu:
		case DerivationRule.Mu:
		case DerivationRule.Xi:
		case DerivationRule.Unary: {
			if (derivation.child.rule === DerivationRule.Id) return null;
			const child = pruneDerivation(derivation.child);
			if (!child) return null;
			return { ...derivation, child };
		}
		case DerivationRule.Binary:
		case DerivationRule.Seq: {
			const children: PrunedDerivation[] = [];
			for (let i = 0; i < derivation.children.length; i++) {
				const child = derivation.children[i];
				if (child.rule === DerivationRule.Id) continue;
				const prunedChild = pruneDerivation(child);
				if (!prunedChild) continue;
				children.push(prunedChild);
			}
			if (children.length === 0) return null;
			return { ...derivation, children };
		}
	}
}

const DERIVATION_RULE_NAMES: Record<DerivationRule, string> = {
	[DerivationRule.Id]: "id",
	[DerivationRule.Beta]: "β",
	[DerivationRule.Delta]: "δ",
	[DerivationRule.Nu]: "ν",
	[DerivationRule.Mu]: "μ",
	[DerivationRule.Xi]: "ξ",
	[DerivationRule.Unary]: "",
	[DerivationRule.Binary]: "",
	[DerivationRule.Seq]: "seq",
};

export function derivationToStringSimple(derivation: Derivation, prune = true): string {
	const lines: string[] = [];
	if (prune) {
		const pruned = pruneDerivation(derivation);
		if (!pruned) {
			console.warn("Derivation has no steps");
		} else {
			derivationToStringSimpleInner(0, lines, pruned);
			return lines.join("\n");
		}
	}
	derivationToStringSimpleInner(0, lines, derivation);
	return lines.join("\n");
}

export function getLabel(derivation: Derivation | PrunedDerivation) {
	switch (derivation.rule) {
		case DerivationRule.Unary:
			switch (derivation.before.op) {
				case ast.UnaryOp.Negate:
					return "neg";
			}
		case DerivationRule.Binary:
			switch (derivation.before.op) {
				case ast.BinaryOp.Add:
					return "add";
				case ast.BinaryOp.Sub:
					return "sub";
				case ast.BinaryOp.Mul:
					return "mul";
			}
		default:
			return DERIVATION_RULE_NAMES[derivation.rule];
	}
}

function leading(depth: number, label: string) {
	return "| ".repeat(depth) + label.padEnd(6);
}

function derivationToStringSimpleInner(depth: number, lines: string[], derivation: Derivation | PrunedDerivation) {
	const label = getLabel(derivation);
	const prefix = leading(depth, label);
	if (derivation.rule === DerivationRule.Id) {
		if (depth === 0) {
			lines.push(prefix + " = " + ast.toString(derivation.after));
		}
		return;
	}
	if (derivation.rule === DerivationRule.Seq) {
		for (let i = 0; i < derivation.children.length; i++) {
			if (derivation.children[i].rule === DerivationRule.Id) continue;
			derivationToStringSimpleInner(depth, lines, derivation.children[i]);
		}
		return;
	}
	if (derivation.rule === DerivationRule.Beta || derivation.rule === DerivationRule.Delta) {
		lines.push(prefix + " > " + ast.toString(derivation.before));
		lines.push(prefix + " < " + ast.toString(derivation.after));
		return;
	}
	if (derivation.rule === DerivationRule.Binary) {
		lines.push(prefix + " > " + ast.toString(derivation.before));
		for (let i = 0; i < derivation.children.length; i++) {
			if (derivation.children[i].rule === DerivationRule.Id) continue;
			derivationToStringSimpleInner(depth + 1, lines, derivation.children[i]);
		}
		lines.push(prefix + " < " + ast.toString(derivation.after));
		return;
	}
	if (derivation.child.rule === DerivationRule.Id) {
		lines.push(prefix + " = " + ast.toString(derivation.after));
		return;
	}
	lines.push(prefix + " > " + ast.toString(derivation.before));
	derivationToStringSimpleInner(depth + 1, lines, derivation.child);
	lines.push(prefix + " < " + ast.toString(derivation.after));
}

type LambdaFrame =
	| { rule: DerivationRule.Xi; lam: ast.Abstraction }
	| { rule: DerivationRule.Unary; op: ast.UnaryOp }
	| { rule: DerivationRule.Nu | DerivationRule.Mu; expr: ast.Expression }
	| { rule: DerivationRule.Binary; op: ast.BinaryOp; isLeft: boolean; expr: ast.Expression };

type LambdaStep = {
	rule: DerivationRule.Beta | DerivationRule.Delta;
	path: LambdaFrame[]; // outermost first
	redex: ast.Expression;
	contractum: ast.Expression;
};

function derivationToSteps(d: Derivation): LambdaStep[] {
	const within = (child: Derivation, frame: LambdaFrame) =>
		derivationToSteps(child).map((s) => {
			s.path.unshift(frame);
			return s;
		});
	switch (d.rule) {
		case DerivationRule.Id:
			return [];
		case DerivationRule.Beta:
		case DerivationRule.Delta:
			return [{ rule: d.rule, path: [], redex: d.before, contractum: d.after }];
		case DerivationRule.Nu:
			return within(d.child, { rule: d.rule, expr: d.before.right });
		case DerivationRule.Mu:
			return within(d.child, { rule: d.rule, expr: d.before.left });
		case DerivationRule.Xi:
			return within(d.child, { rule: d.rule, lam: d.before });
		case DerivationRule.Unary:
			return within(d.child, { rule: d.rule, op: d.before.op });
		case DerivationRule.Binary:
			return d.children.flatMap((child, i) =>
				within(child, {
					rule: d.rule,
					op: d.before.op,
					isLeft: i === 0,
					expr: i === 0 ? d.before.right : d.children[0].after,
				}),
			);
		case DerivationRule.Seq:
			return d.children.flatMap(derivationToSteps);
	}
}

const BINARY_OP_TO_SYMBOL: Record<ast.BinaryOp, string> = {
	[ast.BinaryOp.Add]: "+",
	[ast.BinaryOp.Sub]: "-",
	[ast.BinaryOp.Mul]: "*",
};

const UNARY_OP_TO_SYMBOL: Record<ast.UnaryOp, string> = {
	[ast.UnaryOp.Negate]: "-",
};

function getPrecedence(op: ast.BinaryOp) {
	switch (op) {
		case ast.BinaryOp.Add:
		case ast.BinaryOp.Sub:
			return { lbp: 1, rbp: 2 };
		case ast.BinaryOp.Mul:
			return { lbp: 3, rbp: 4 };
	}
}

function isAtom(expr: ast.Expression): boolean {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Variable:
			return true;
		case ast.ExpressionKind.Int:
			return expr.value >= 0;
		default:
			return false;
	}
}

function shouldParenthesizeLeft(expr: ast.Application): boolean {
	return !isAtom(expr.left) && expr.left.kind !== ast.ExpressionKind.Application;
}

function shouldParenthesizeRight(expr: ast.Application): boolean {
	return !isAtom(expr.right);
}

function shouldParenthesizeLeftBinary(expr: ast.Binary): boolean {
	if (expr.left.kind === ast.ExpressionKind.Abstraction) return true;
	if (!ast.isBinary(expr.left)) return false;
	const outer = getPrecedence(expr.op);
	const inner = getPrecedence(expr.left.op);
	return outer.lbp > inner.rbp;
}

function shouldParenthesizeRightBinary(expr: ast.Binary): boolean {
	if (expr.right.kind === ast.ExpressionKind.Abstraction) return true;
	if (!ast.isBinary(expr.right)) return false;
	const outer = getPrecedence(expr.op);
	const inner = getPrecedence(expr.right.op);
	return inner.lbp <= outer.rbp;
}

const space = piece(" ");
const kw = (s: string) => piece(s, "keyword");
const paren = (pieces: Piece[], b: boolean) => (b ? concat(piece("(", "paren"), pieces, piece(")", "paren")) : pieces);
const binOp = (op: ast.BinaryOp) => concat(space, piece(BINARY_OP_TO_SYMBOL[op], "operator"), space);

const HOLE: Piece = { text: "" };

type Scope = (string | null)[]; // innermost last

function bind(names: Names, scope: Scope, binder: Binder): Scope {
	const name = names.get(binder) ?? null;
	return [...scope, name === null ? null : freshName(scope, name)];
}

function exprToPieces(names: Names, scope: Scope, expr: ast.Expression, hole?: ast.Expression): Piece[] {
	if (expr === hole) return [HOLE];
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
			return piece("()", "literal-unit");
		case ast.ExpressionKind.Int:
			return piece(expr.value.toString(), "literal-int");
		case ast.ExpressionKind.Variable:
			return piece(scope[scope.length - 1 - expr.index] ?? `#${expr.index.toString()}`, "variable");
		case ast.ExpressionKind.Application:
			return concat(
				paren(exprToPieces(names, scope, expr.left, hole), shouldParenthesizeLeft(expr)),
				space,
				paren(exprToPieces(names, scope, expr.right, hole), shouldParenthesizeRight(expr)),
			);
		case ast.ExpressionKind.Abstraction: {
			const inner = bind(names, scope, expr);
			const name = inner[inner.length - 1];
			return concat(kw("λ"), piece(name ?? ""), piece(".", "punctuation"), exprToPieces(names, inner, expr.body, hole));
		}
		case ast.ExpressionKind.Unary:
			return concat(
				piece(UNARY_OP_TO_SYMBOL[expr.op], "operator"),
				paren(exprToPieces(names, scope, expr.expr, hole), true),
			);
		case ast.ExpressionKind.Binary:
			return concat(
				paren(exprToPieces(names, scope, expr.left, hole), shouldParenthesizeLeftBinary(expr)),
				binOp(expr.op),
				paren(exprToPieces(names, scope, expr.right, hole), shouldParenthesizeRightBinary(expr)),
			);
	}
}

function frameLabel(f: LambdaFrame): string {
	switch (f.rule) {
		case DerivationRule.Unary:
			return UNARY_OP_TO_SYMBOL[f.op];
		case DerivationRule.Binary:
			return BINARY_OP_TO_SYMBOL[f.op];
		default:
			return DERIVATION_RULE_NAMES[f.rule];
	}
}

const lambdaPlug =
	(names: Names): Plug<ast.Expression, LambdaFrame> =>
	(f, child) => {
		switch (f.rule) {
			case DerivationRule.Nu:
				return ast.application(child, f.expr);
			case DerivationRule.Mu:
				return ast.application(f.expr, child);
			case DerivationRule.Xi: {
				const lam = ast.abstraction(child);
				copyName(names, f.lam, lam);
				return lam;
			}
			case DerivationRule.Unary:
				return ast.unary(f.op, child);
			case DerivationRule.Binary:
				return f.isLeft ? ast.binary(f.op, child, f.expr) : ast.binary(f.op, f.expr, child);
		}
	};

function lambdaPrinter(
	names: Names,
	plug: Plug<ast.Expression, LambdaFrame>,
	path: LambdaFrame[],
	free: string[],
): Printer<ast.Expression, LambdaFrame, Piece> {
	const inScope = (scope: Scope) =>
		holePrinter(
			(expr: ast.Expression, hole?: ast.Expression) => exprToPieces(names, scope, expr, hole),
			plug,
			HOLE,
			frameLabel,
		);
	const outerScopes = new Map<LambdaFrame, Scope>();
	let scope: Scope = free;
	for (const f of path) {
		outerScopes.set(f, scope);
		if (f.rule === DerivationRule.Xi) scope = bind(names, scope, f.lam);
	}
	const focus = inScope(scope);
	return {
		print: focus.print,
		printFrame: (f, child) => inScope(outerScopes.get(f) ?? []).printFrame(f, child),
	};
}

export function writeDerivation(
	writer: Writer<Piece>,
	derivation: Derivation,
	names: Names = new Map(),
	free: string[] = [],
	options: RenderOptions = {},
) {
	names = namesThrough(names, derivation);
	const plug = lambdaPlug(names);
	const lambdaSteps = derivationToSteps(derivation);
	if (lambdaSteps.length === 0) {
		for (const p of exprToPieces(names, free, derivation.after)) {
			writer.write(p);
		}
		writer.break();
		return;
	}
	const steps: Step<Piece>[] = lambdaSteps.map((s) => {
		const printer = lambdaPrinter(names, plug, s.path, free);
		return {
			label: DERIVATION_RULE_NAMES[s.rule],
			before: plugAll(plug, printer, s.redex, s.path)[0],
			after: plugAll(plug, printer, s.contractum, s.path)[0],
		};
	});
	renderDerivation(writer, steps, options);
}

export function derivationToString(
	derivation: Derivation,
	names?: Names,
	free?: string[],
	options: RenderOptions = {},
): string {
	const writer = stringWriter();
	writeDerivation(writer, derivation, names, free, options);
	return writer.output().trimEnd();
}
