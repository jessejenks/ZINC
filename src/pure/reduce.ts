import type { Abstraction, Application, Expression } from "./core";
import * as ast from "./core";

export function shift(i: number, c: number, expr: Expression): Expression {
	switch (expr.kind) {
		case ast.ExpressionKind.Variable:
			if (expr.index < c) {
				return expr;
			}
			return ast.variable(expr.index + i);
		case ast.ExpressionKind.Application:
			return ast.application(shift(i, c, expr.left), shift(i, c, expr.right));
		case ast.ExpressionKind.Abstraction:
			return ast.abstraction(shift(i, c + 1, expr.body));
	}
}

export function substitute(t: Expression, n: number, e: Expression): Expression {
	switch (t.kind) {
		case ast.ExpressionKind.Variable:
			return t.index === n ? e : t;
		case ast.ExpressionKind.Application:
			return ast.application(substitute(t.left, n, e), substitute(t.right, n, e));
		case ast.ExpressionKind.Abstraction:
			return ast.abstraction(substitute(t.body, n + 1, shift(1, 0, e)));
	}
}

export const enum DerivationRule {
	Id,
	Beta,
	Mu,
	Nu,
	Xi,
	Seq,
}

export const DERIVATION_RULE_NAMES: Record<DerivationRule, string> = {
	[DerivationRule.Id]: "id",
	[DerivationRule.Beta]: "β",
	[DerivationRule.Mu]: "μ",
	[DerivationRule.Nu]: "ν",
	[DerivationRule.Xi]: "ξ",
	[DerivationRule.Seq]: "seq",
};

export type IdDerivation = {
	rule: DerivationRule.Id;
	after: Expression;
};

export type BetaDerivation = {
	rule: DerivationRule.Beta;
	before: Application;
	after: Expression;
};

export type MuDerivation = {
	rule: DerivationRule.Mu;
	before: Application;
	after: Application;
	child: Derivation;
};

export type NuDerivation = {
	rule: DerivationRule.Nu;
	before: Application;
	after: Application;
	child: Derivation;
};

export type XiDerivation = {
	rule: DerivationRule.Xi;
	before: Abstraction;
	after: Abstraction;
	child: Derivation;
};

export type SeqDerivation = {
	rule: DerivationRule.Seq;
	before: Expression;
	after: Expression;
	children: Derivation[];
};

export type Derivation = IdDerivation | BetaDerivation | XiDerivation | MuDerivation | NuDerivation | SeqDerivation;

const id = (expr: Expression): IdDerivation => ({
	rule: DerivationRule.Id,
	after: expr,
});

const seq = (before: Expression, after: Expression, children: Derivation[]): SeqDerivation => ({
	rule: DerivationRule.Seq,
	before,
	after,
	children,
});

const isAppLeftLambda = (expr: Application): expr is Application & { left: Abstraction } =>
	ast.isAbstraction(expr.left);

export const betaStep = (left: Abstraction, right: Expression): Expression =>
	shift(-1, 0, substitute(left.body, 0, shift(1, 0, right)));

const beta = (expr: Application & { left: Abstraction }): Expression => betaStep(expr.left, expr.right);

const betaDerive = (expr: Application & { left: Abstraction }): BetaDerivation => {
	const substituted = betaStep(expr.left, expr.right);
	return {
		rule: DerivationRule.Beta,
		before: expr,
		after: substituted,
	};
};

const mu = (expr: Application, reduce: (expr: Expression) => Expression): Application => {
	return ast.application(reduce(expr.left), expr.right);
};

const muDerive = (expr: Application, reduce: (expr: Expression) => Derivation): MuDerivation => {
	const child = reduce(expr.left);
	return {
		rule: DerivationRule.Mu,
		before: expr,
		after: ast.application(child.after, expr.right),
		child,
	};
};

const nu = (expr: Application, reduce: (expr: Expression) => Expression): Application => {
	return ast.application(expr.left, reduce(expr.right));
};

const nuDerive = (expr: Application, reduce: (expr: Expression) => Derivation): NuDerivation => {
	const child = reduce(expr.right);
	return {
		rule: DerivationRule.Nu,
		before: expr,
		after: ast.application(expr.left, child.after),
		child,
	};
};

const xi = (expr: Abstraction, reduce: (expr: Expression) => Expression): Abstraction => {
	return ast.abstraction(reduce(expr.body));
};

const xiDerive = (expr: Abstraction, reduce: (expr: Expression) => Derivation): XiDerivation => {
	const child = reduce(expr.body);
	return {
		rule: DerivationRule.Xi,
		before: expr,
		after: ast.abstraction(child.after),
		child,
	};
};

export function derivationToString(derivation: Derivation): string {
	const lines: string[] = [];
	derivationToStringInner(0, lines, derivation);
	return lines.join("\n");
}

function leading(depth: number, label: string) {
	return "| ".repeat(depth) + label.padEnd(6);
}

function derivationToStringInner(depth: number, lines: string[], derivation: Derivation) {
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
			derivationToStringInner(depth, lines, derivation.children[i]);
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
	derivationToStringInner(depth + 1, lines, derivation.child);
	lines.push(prefix + " < " + ast.toString(derivation.after));
}

export const callByName = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Variable:
		case ast.ExpressionKind.Abstraction:
			return expr;
		case ast.ExpressionKind.Application: {
			const left = mu(expr, callByName);
			if (isAppLeftLambda(left)) {
				return callByName(beta(left));
			}
			return left;
		}
	}
};

export const callByNameDerive = (expr: Expression): Derivation => {
	switch (expr.kind) {
		case ast.ExpressionKind.Variable:
		case ast.ExpressionKind.Abstraction:
			return id(expr);
		case ast.ExpressionKind.Application: {
			const left = muDerive(expr, callByNameDerive);
			if (isAppLeftLambda(left.after)) {
				const b = betaDerive(left.after);
				const post = callByNameDerive(b.after);
				return seq(expr, post.after, [left, b, post]);
			}
			return left;
		}
	}
};

export const callByValue = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Variable:
		case ast.ExpressionKind.Abstraction:
			return expr;
		case ast.ExpressionKind.Application: {
			const left = mu(expr, callByValue);
			const right = nu(left, callByValue);
			if (isAppLeftLambda(right)) {
				return callByValue(beta(right));
			}
			return right;
		}
	}
};

export const callByValueDerive = (expr: Expression): Derivation => {
	switch (expr.kind) {
		case ast.ExpressionKind.Variable:
		case ast.ExpressionKind.Abstraction:
			return id(expr);
		case ast.ExpressionKind.Application: {
			const left = muDerive(expr, callByValueDerive);
			const right = nuDerive(left.after, callByValueDerive);
			if (isAppLeftLambda(right.after)) {
				const b = betaDerive(right.after);
				const post = callByValueDerive(b.after);
				return seq(expr, post.after, [left, right, b, post]);
			}
			return seq(expr, right.after, [left, right]);
		}
	}
};

export const normalOrder = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Variable:
			return expr;
		case ast.ExpressionKind.Abstraction:
			return xi(expr, normalOrder);
		case ast.ExpressionKind.Application: {
			const left = mu(expr, callByName);
			if (isAppLeftLambda(left)) {
				return normalOrder(beta(left));
			}
			return nu(mu(left, normalOrder), normalOrder);
		}
	}
};

export const normalOrderDerive = (expr: Expression): Derivation => {
	switch (expr.kind) {
		case ast.ExpressionKind.Variable:
			return id(expr);
		case ast.ExpressionKind.Abstraction:
			return xiDerive(expr, normalOrderDerive);
		case ast.ExpressionKind.Application: {
			const left = muDerive(expr, callByNameDerive);
			if (isAppLeftLambda(left.after)) {
				const b = betaDerive(left.after);
				const post = normalOrderDerive(b.after);
				return seq(expr, post.after, [left, b, post]);
			}
			const l = muDerive(left.after, normalOrderDerive);
			const r = nuDerive(l.after, normalOrderDerive);
			return seq(expr, r.after, [left, l, r]);
		}
	}
};

export const applicativeOrder = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Variable:
			return expr;
		case ast.ExpressionKind.Abstraction:
			return xi(expr, applicativeOrder);
		case ast.ExpressionKind.Application: {
			const left = mu(expr, applicativeOrder);
			const right = nu(left, applicativeOrder);
			if (isAppLeftLambda(right)) {
				return applicativeOrder(beta(right));
			}
			return right;
		}
	}
};

export const applicativeOrderDerive = (expr: Expression): Derivation => {
	switch (expr.kind) {
		case ast.ExpressionKind.Variable:
			return id(expr);
		case ast.ExpressionKind.Abstraction:
			return xiDerive(expr, applicativeOrderDerive);
		case ast.ExpressionKind.Application: {
			const left = muDerive(expr, applicativeOrderDerive);
			const right = nuDerive(left.after, applicativeOrderDerive);
			if (isAppLeftLambda(right.after)) {
				const b = betaDerive(right.after);
				const post = applicativeOrderDerive(b.after);
				return seq(expr, post.after, [left, right, b, post]);
			}
			return seq(expr, right.after, [left, right]);
		}
	}
};

export const headReduction = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Variable:
			return expr;
		case ast.ExpressionKind.Abstraction:
			return xi(expr, headReduction);
		case ast.ExpressionKind.Application: {
			const left = mu(expr, headReduction);
			if (isAppLeftLambda(left)) {
				return headReduction(beta(left));
			}
			return left;
		}
	}
};

export const headReductionDerive = (expr: Expression): Derivation => {
	switch (expr.kind) {
		case ast.ExpressionKind.Variable:
			return id(expr);
		case ast.ExpressionKind.Abstraction:
			return xiDerive(expr, headReductionDerive);
		case ast.ExpressionKind.Application: {
			const left = muDerive(expr, headReductionDerive);
			if (isAppLeftLambda(left.after)) {
				const b = betaDerive(left.after);
				const post = headReductionDerive(b.after);
				return seq(expr, post.after, [left, b, post]);
			}
			return left;
		}
	}
};
