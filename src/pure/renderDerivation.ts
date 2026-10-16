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
import type { BetaDerivation, Derivation } from "./reduce";
import { DerivationRule } from "./reduce";

type NormalizedDerivation =
	| BetaDerivation
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
			return derivation;
		case DerivationRule.Nu:
		case DerivationRule.Mu:
		case DerivationRule.Xi: {
			if (derivation.child.rule === DerivationRule.Id) return null;
			const child = normalizeDerivation(derivation.child);
			if (!child) return null;
			return { ...derivation, child };
		}
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

const DERIVATION_RULE_NAMES: Record<DerivationRule, string> = {
	[DerivationRule.Id]: "id",
	[DerivationRule.Beta]: "β",
	[DerivationRule.Nu]: "ν",
	[DerivationRule.Mu]: "μ",
	[DerivationRule.Xi]: "ξ",
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

function leading(depth: number, label: string) {
	return "| ".repeat(depth) + label.padEnd(6);
}

function derivationToStringSimpleInner(depth: number, lines: string[], derivation: Derivation | NormalizedDerivation) {
	const prefix = leading(depth, DERIVATION_RULE_NAMES[derivation.rule]);
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
	if (derivation.rule === DerivationRule.Beta) {
		lines.push(prefix + " > " + ast.toString(derivation.before));
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

type LambdaFrame = { rule: DerivationRule.Xi } | { rule: DerivationRule.Nu | DerivationRule.Mu; expr: ast.Expression };

type LambdaStep = {
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
			return [{ path: [], redex: d.before, contractum: d.after }];
		case DerivationRule.Nu:
			return within(d.child, { rule: d.rule, expr: d.before.right });
		case DerivationRule.Mu:
			return within(d.child, { rule: d.rule, expr: d.before.left });
		case DerivationRule.Xi:
			return within(d.child, { rule: d.rule });
		case DerivationRule.Seq:
			return d.children.flatMap(normalizeToSteps);
	}
}

function isAtom(expr: ast.Expression): boolean {
	switch (expr.kind) {
		case ast.ExpressionKind.Variable:
			return true;
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

const space = piece(" ");
const kw = (s: string) => piece(s, "keyword");
const paren = (pieces: Piece[], b: boolean) => (b ? concat(piece("("), pieces, piece(")")) : pieces);
const HOLE: Piece = { text: "" };

function exprToPieces(expr: ast.Expression, hole?: ast.Expression): Piece[] {
	if (expr === hole) return [HOLE];
	switch (expr.kind) {
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
		}
	},
};

const lambdaPrinter = holePrinter(exprToPieces, lambdaZipper.plug, HOLE, (f) => DERIVATION_RULE_NAMES[f.rule]);

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
		label: DERIVATION_RULE_NAMES[DerivationRule.Beta],
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
