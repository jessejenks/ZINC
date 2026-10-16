import {
	concat,
	holePrinter,
	Piece,
	piece,
	plugAll,
	renderDerivation,
	RenderOptions,
	Step,
	stringWriter,
	UpZipper,
	Writer,
} from "../utils/render";
import * as ast from "./core";
import type {
	BetaDerivation,
	DeltaDerivation,
	Derivation,
	FixDerivation,
	IotaDerivation,
	ZetaDerivation,
} from "./reduce";
import { DerivationRule } from "./reduce";

export type NormalizedDerivation =
	| BetaDerivation
	| DeltaDerivation
	| ZetaDerivation
	| FixDerivation
	| IotaDerivation
	| {
			rule: DerivationRule.Nu | DerivationRule.Mu;
			before: ast.Application;
			after: ast.Application;
			child: NormalizedDerivation;
	  }
	| {
			rule: DerivationRule.Xi;
			before: ast.Abstraction;
			after: ast.Abstraction;
			child: NormalizedDerivation;
	  }
	| {
			rule: DerivationRule.Unary;
			before: ast.Unary;
			after: ast.Unary;
			child: NormalizedDerivation;
	  }
	| {
			rule: DerivationRule.Binary;
			before: ast.Binary;
			after: ast.Binary;
			children: NormalizedDerivation[];
	  }
	| {
			rule: DerivationRule.LetBound | DerivationRule.LetBody;
			before: ast.LetIn;
			after: ast.LetIn;
			child: NormalizedDerivation;
	  }
	| {
			rule: DerivationRule.IfCondition | DerivationRule.IfConsequence | DerivationRule.IfAlternative;
			before: ast.IfElse;
			after: ast.IfElse;
			child: NormalizedDerivation;
	  }
	| {
			rule: DerivationRule.Seq;
			before: ast.Expression;
			after: ast.Expression;
			children: NormalizedDerivation[];
	  };

export function normalizeDerivation(derivation: Derivation): NormalizedDerivation | null {
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
			const child = normalizeDerivation(derivation.child);
			if (!child) return null;
			return { ...derivation, child };
		}
		case DerivationRule.Binary:
		case DerivationRule.Seq: {
			const children: NormalizedDerivation[] = [];
			for (let i = 0; i < derivation.children.length; i++) {
				const child = derivation.children[i];
				if (child.rule === DerivationRule.Id) continue;
				const normalizedChild = normalizeDerivation(child);
				if (!normalizedChild) continue;
				children.push(normalizedChild);
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

export function derivationToStringSimple(derivation: Derivation, normalize = true): string {
	const lines: string[] = [];
	if (normalize) {
		const normalized = normalizeDerivation(derivation);
		if (!normalized) {
			console.warn("Could not normalize derivation");
		} else {
			derivationToStringSimpleInner(0, lines, normalized);
			return lines.join("\n");
		}
	}
	derivationToStringSimpleInner(0, lines, derivation);
	return lines.join("\n");
}

function getLabel(derivation: Derivation | NormalizedDerivation) {
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

function derivationToStringSimpleInner(depth: number, lines: string[], derivation: Derivation | NormalizedDerivation) {
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
	| { rule: DerivationRule.Xi }
	| { rule: DerivationRule.Unary; op: ast.UnaryOp }
	| { rule: DerivationRule.Nu | DerivationRule.Mu; expr: ast.Expression }
	| { rule: DerivationRule.Binary; op: ast.BinaryOp; isLeft: boolean; expr: ast.Expression }
	| { rule: DerivationRule.LetBound; body: ast.Expression; isRecursive: boolean }
	| { rule: DerivationRule.LetBody; bound: ast.Expression; isRecursive: boolean }
	| { rule: DerivationRule.IfCondition; consequence: ast.Expression; alternative: ast.Expression }
	| { rule: DerivationRule.IfConsequence; condition: ast.Expression; alternative: ast.Expression }
	| { rule: DerivationRule.IfAlternative; condition: ast.Expression; consequence: ast.Expression };

type LambdaStep = {
	rule: DerivationRule.Beta | DerivationRule.Delta | DerivationRule.Zeta | DerivationRule.Fix | DerivationRule.Iota;
	path: LambdaFrame[]; // outermost first
	redex: ast.Expression;
	contractum: ast.Expression;
};

function normalizeToSteps(d: Derivation): LambdaStep[] {
	const within = (child: Derivation, frame: LambdaFrame) =>
		normalizeToSteps(child).map((s) => {
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
			return within(d.child, { rule: d.rule });
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
			return d.children.flatMap(normalizeToSteps);
		case DerivationRule.LetBound:
			return within(d.child, { rule: d.rule, body: d.before.body, isRecursive: d.before.isRecursive });
		case DerivationRule.LetBody:
			return within(d.child, { rule: d.rule, bound: d.before.expr, isRecursive: d.before.isRecursive });
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
const paren = (pieces: Piece[], b: boolean) => (b ? concat(piece("("), pieces, piece(")")) : pieces);
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

function exprToPieces(expr: ast.Expression, hole?: ast.Expression): Piece[] {
	if (expr === hole) return [HOLE];
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
			return piece("()", "literal-unit");
		case ast.ExpressionKind.Bool:
			return piece(expr.value ? "true" : "false", "literal-bool");
		case ast.ExpressionKind.Int:
			return piece(expr.value.toString(), "literal-int");
		case ast.ExpressionKind.Variable:
			return piece(`#${expr.index.toString()}`, "variable");
		case ast.ExpressionKind.Application:
			return concat(
				paren(exprToPieces(expr.left, hole), shouldParenthesizeLeft(expr)),
				space,
				paren(exprToPieces(expr.right, hole), shouldParenthesizeRight(expr)),
			);
		case ast.ExpressionKind.Abstraction:
			return concat(kw("λ"), piece("."), exprToPieces(expr.body, hole));
		case ast.ExpressionKind.Unary:
			return concat(piece(UNARY_OP_TO_SYMBOL[expr.op], "operator"), paren(exprToPieces(expr.expr, hole), true));
		case ast.ExpressionKind.Binary:
			return concat(
				paren(exprToPieces(expr.left, hole), shouldParenthesizeLeftBinary(expr)),
				binOp(expr.op),
				paren(exprToPieces(expr.right, hole), shouldParenthesizeRightBinary(expr)),
			);
		case ast.ExpressionKind.LetIn:
			return concat(
				letKw(expr.isRecursive),
				exprToPieces(expr.expr, hole),
				space,
				kw("in"),
				space,
				exprToPieces(expr.body, hole),
			);
		case ast.ExpressionKind.IfElse:
			return concat(
				kw("if"),
				space,
				exprToPieces(expr.condition, hole),
				space,
				kw("then"),
				space,
				exprToPieces(expr.consequence, hole),
				space,
				kw("else"),
				space,
				exprToPieces(expr.alternative, hole),
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

const lambdaZipper: UpZipper<ast.Expression, LambdaFrame> = {
	plug: (f, child) => {
		switch (f.rule) {
			case DerivationRule.Nu:
				return ast.application(child, f.expr);
			case DerivationRule.Mu:
				return ast.application(f.expr, child);
			case DerivationRule.Xi:
				return ast.abstraction(child);
			case DerivationRule.Unary:
				return ast.unary(f.op, child);
			case DerivationRule.Binary:
				return f.isLeft ? ast.binary(f.op, child, f.expr) : ast.binary(f.op, f.expr, child);
			case DerivationRule.LetBound:
				return ast.letIn(child, f.body, f.isRecursive);
			case DerivationRule.LetBody:
				return ast.letIn(f.bound, child, f.isRecursive);
			case DerivationRule.IfCondition:
				return ast.ifElse(child, f.consequence, f.alternative);
			case DerivationRule.IfConsequence:
				return ast.ifElse(f.condition, child, f.alternative);
			case DerivationRule.IfAlternative:
				return ast.ifElse(f.condition, f.consequence, child);
		}
	},
};

const lambdaPrinter = holePrinter(exprToPieces, lambdaZipper.plug, HOLE, frameLabel);

export function writeDerivation(writer: Writer<Piece>, derivation: Derivation, options: RenderOptions = {}) {
	const lambdaSteps = normalizeToSteps(derivation);
	if (lambdaSteps.length === 0) {
		for (const p of lambdaPrinter.print(derivation.after)) {
			writer.write(p);
		}
		writer.break();
		return;
	}
	const steps: Step<Piece>[] = lambdaSteps.map((s) => ({
		label: DERIVATION_RULE_NAMES[s.rule],
		before: plugAll(lambdaZipper, lambdaPrinter, s.redex, s.path)[0],
		after: plugAll(lambdaZipper, lambdaPrinter, s.contractum, s.path)[0],
	}));
	renderDerivation(writer, steps, options);
}

export function derivationToString(derivation: Derivation, options: RenderOptions = {}): string {
	const writer = stringWriter();
	writeDerivation(writer, derivation, options);
	return writer.output().trimEnd();
}
