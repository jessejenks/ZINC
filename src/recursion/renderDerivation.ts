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
import type {
	BetaDerivation,
	DeltaDerivation,
	Derivation,
	FixDerivation,
	IotaDerivation,
	ZetaDerivation,
} from "./reduce";
import { DerivationRule } from "./reduce";

export type PrunedDerivation =
	| BetaDerivation
	| DeltaDerivation
	| ZetaDerivation
	| FixDerivation
	| IotaDerivation
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
			rule: DerivationRule.LetBound | DerivationRule.LetBody;
			before: ast.LetIn;
			after: ast.LetIn;
			child: PrunedDerivation;
	  }
	| {
			rule: DerivationRule.IfCondition | DerivationRule.IfConsequence | DerivationRule.IfAlternative;
			before: ast.IfElse;
			after: ast.IfElse;
			child: PrunedDerivation;
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
		case DerivationRule.Zeta:
		case DerivationRule.Fix:
		case DerivationRule.Iota:
			return derivation;
		case DerivationRule.Nu:
		case DerivationRule.Mu:
		case DerivationRule.Xi:
		case DerivationRule.Unary:
		case DerivationRule.LetBound:
		case DerivationRule.LetBody:
		case DerivationRule.IfCondition:
		case DerivationRule.IfConsequence:
		case DerivationRule.IfAlternative: {
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

export const DERIVATION_RULE_NAMES: Record<DerivationRule, string> = {
	[DerivationRule.Id]: "id",
	[DerivationRule.Beta]: "β",
	[DerivationRule.Delta]: "δ",
	[DerivationRule.Zeta]: "ζ",
	[DerivationRule.Fix]: "fix",
	[DerivationRule.Iota]: "ι",
	[DerivationRule.Nu]: "ν",
	[DerivationRule.Mu]: "μ",
	[DerivationRule.Xi]: "ξ",
	[DerivationRule.LetBound]: "let",
	[DerivationRule.LetBody]: "in",
	[DerivationRule.IfCondition]: "if",
	[DerivationRule.IfConsequence]: "then",
	[DerivationRule.IfAlternative]: "else",
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

function getLabel(derivation: Derivation | PrunedDerivation) {
	switch (derivation.rule) {
		case DerivationRule.Unary:
			switch (derivation.before.op) {
				case ast.UnaryOp.Negate:
					return "neg";
				case ast.UnaryOp.BitNot:
					return "bnot";
				case ast.UnaryOp.Not:
					return "not";
			}
		case DerivationRule.Binary:
			switch (derivation.before.op) {
				case ast.BinaryOp.Add:
					return "add";
				case ast.BinaryOp.Sub:
					return "sub";
				case ast.BinaryOp.Mul:
					return "mul";
				case ast.BinaryOp.Div:
					return "div";
				case ast.BinaryOp.Lt:
					return "lt";
				case ast.BinaryOp.Gt:
					return "gt";
				case ast.BinaryOp.Lte:
					return "lte";
				case ast.BinaryOp.Gte:
					return "gte";
				case ast.BinaryOp.Eq:
					return "eq";
				case ast.BinaryOp.BitAnd:
					return "band";
				case ast.BinaryOp.BitOr:
					return "bor";
				case ast.BinaryOp.And:
					return "and";
				case ast.BinaryOp.Or:
					return "or";
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
	if (
		derivation.rule === DerivationRule.Beta ||
		derivation.rule === DerivationRule.Delta ||
		derivation.rule === DerivationRule.Zeta ||
		derivation.rule === DerivationRule.Fix ||
		derivation.rule === DerivationRule.Iota
	) {
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
	| { rule: DerivationRule.Binary; op: ast.BinaryOp; isLeft: boolean; expr: ast.Expression }
	| { rule: DerivationRule.LetBound | DerivationRule.LetBody; letIn: ast.LetIn }
	| { rule: DerivationRule.IfCondition; consequence: ast.Expression; alternative: ast.Expression }
	| { rule: DerivationRule.IfConsequence; condition: ast.Expression; alternative: ast.Expression }
	| { rule: DerivationRule.IfAlternative; condition: ast.Expression; consequence: ast.Expression };

type LambdaStep = {
	rule: DerivationRule.Beta | DerivationRule.Delta | DerivationRule.Zeta | DerivationRule.Fix | DerivationRule.Iota;
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
		case DerivationRule.Zeta:
		case DerivationRule.Fix:
		case DerivationRule.Iota:
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
		case DerivationRule.LetBound:
		case DerivationRule.LetBody:
			return within(d.child, { rule: d.rule, letIn: d.before });
		case DerivationRule.IfCondition:
			return within(d.child, {
				rule: d.rule,
				consequence: d.before.consequence,
				alternative: d.before.alternative,
			});
		case DerivationRule.IfConsequence:
			return within(d.child, { rule: d.rule, condition: d.before.condition, alternative: d.before.alternative });
		case DerivationRule.IfAlternative:
			return within(d.child, { rule: d.rule, condition: d.before.condition, consequence: d.before.consequence });
	}
}

const space = piece(" ");
const kw = (s: string) => piece(s, "keyword");
const paren = (pieces: Piece[], b: boolean) => (b ? concat(piece("(", "paren"), pieces, piece(")", "paren")) : pieces);
const binOp = (op: ast.BinaryOp) => concat(space, piece(BINARY_OP_TO_SYMBOL[op], "operator"), space);
const letKw = (isRecursive: boolean) => concat(kw(isRecursive ? "let rec" : "let"), space);

const BINARY_OP_TO_SYMBOL: Record<ast.BinaryOp, string> = {
	[ast.BinaryOp.Add]: "+",
	[ast.BinaryOp.Sub]: "-",
	[ast.BinaryOp.Mul]: "*",
	[ast.BinaryOp.Div]: "/",
	[ast.BinaryOp.Lt]: "<",
	[ast.BinaryOp.Gt]: ">",
	[ast.BinaryOp.Lte]: "<=",
	[ast.BinaryOp.Gte]: ">=",
	[ast.BinaryOp.Eq]: "==",
	[ast.BinaryOp.BitAnd]: "&",
	[ast.BinaryOp.BitOr]: "|",
	[ast.BinaryOp.And]: "&&",
	[ast.BinaryOp.Or]: "||",
};

const UNARY_OP_TO_SYMBOL: Record<ast.UnaryOp, string> = {
	[ast.UnaryOp.Negate]: "-",
	[ast.UnaryOp.BitNot]: "~",
	[ast.UnaryOp.Not]: "!",
};

function getPrecedence(op: ast.BinaryOp) {
	switch (op) {
		case ast.BinaryOp.Or:
			return { lbp: 1, rbp: 2 };
		case ast.BinaryOp.And:
			return { lbp: 3, rbp: 4 };
		case ast.BinaryOp.Lt:
		case ast.BinaryOp.Gt:
		case ast.BinaryOp.Lte:
		case ast.BinaryOp.Gte:
		case ast.BinaryOp.Eq:
			return { lbp: 5, rbp: 6, nonAssociative: true };
		case ast.BinaryOp.Add:
		case ast.BinaryOp.Sub:
		case ast.BinaryOp.BitOr:
			return { lbp: 7, rbp: 8 };
		case ast.BinaryOp.Mul:
		case ast.BinaryOp.Div:
		case ast.BinaryOp.BitAnd:
			return { lbp: 9, rbp: 10 };
	}
}

function isAtom(expr: ast.Expression): boolean {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Bool:
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

function extendsRight(expr: ast.Expression): boolean {
	switch (expr.kind) {
		case ast.ExpressionKind.Abstraction:
		case ast.ExpressionKind.LetIn:
		case ast.ExpressionKind.IfElse:
			return true;
		default:
			return false;
	}
}

function shouldParenthesizeLeftBinary(expr: ast.Binary): boolean {
	if (extendsRight(expr.left)) return true;
	if (!ast.isBinary(expr.left)) return false;
	const outer = getPrecedence(expr.op);
	const inner = getPrecedence(expr.left.op);
	return outer.lbp > inner.rbp;
}

function shouldParenthesizeRightBinary(expr: ast.Binary): boolean {
	if (extendsRight(expr.right)) return true;
	if (!ast.isBinary(expr.right)) return false;
	const outer = getPrecedence(expr.op);
	const inner = getPrecedence(expr.right.op);
	return inner.lbp <= outer.rbp;
}

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
		case ast.ExpressionKind.Bool:
			return piece(expr.value ? "true" : "false", "literal-bool");
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
		case ast.ExpressionKind.LetIn: {
			const inner = bind(names, scope, expr);
			const name = inner[inner.length - 1];
			return concat(
				letKw(expr.isRecursive),
				name === null ? [] : concat(piece(name), space, piece("=", "punctuation"), space),
				exprToPieces(names, expr.isRecursive ? inner : scope, expr.expr, hole),
				space,
				kw("in"),
				space,
				exprToPieces(names, inner, expr.body, hole),
			);
		}
		case ast.ExpressionKind.IfElse:
			return concat(
				kw("if"),
				space,
				exprToPieces(names, scope, expr.condition, hole),
				space,
				kw("then"),
				space,
				exprToPieces(names, scope, expr.consequence, hole),
				space,
				kw("else"),
				space,
				exprToPieces(names, scope, expr.alternative, hole),
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
			case DerivationRule.LetBound: {
				const letIn = ast.letIn(child, f.letIn.body, f.letIn.isRecursive);
				copyName(names, f.letIn, letIn);
				return letIn;
			}
			case DerivationRule.LetBody: {
				const letIn = ast.letIn(f.letIn.expr, child, f.letIn.isRecursive);
				copyName(names, f.letIn, letIn);
				return letIn;
			}
			case DerivationRule.IfCondition:
				return ast.ifElse(child, f.consequence, f.alternative);
			case DerivationRule.IfConsequence:
				return ast.ifElse(f.condition, child, f.alternative);
			case DerivationRule.IfAlternative:
				return ast.ifElse(f.condition, f.consequence, child);
		}
	};

function holeBinder(f: LambdaFrame): Binder | null {
	switch (f.rule) {
		case DerivationRule.Xi:
			return f.lam;
		case DerivationRule.LetBody:
			return f.letIn;
		case DerivationRule.LetBound:
			return f.letIn.isRecursive ? f.letIn : null;
		default:
			return null;
	}
}

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
		const binder = holeBinder(f);
		if (binder) scope = bind(names, scope, binder);
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
