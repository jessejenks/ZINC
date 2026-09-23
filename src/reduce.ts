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

const enum DerivationKind {
	Id,
	Beta,
	Mu,
	Nu,
	Xi,
	Seq,
}

const DERIVATION_RULE_NAMES: Record<DerivationKind, string> = {
	[DerivationKind.Id]: "id",
	[DerivationKind.Beta]: "β",
	[DerivationKind.Mu]: "μ",
	[DerivationKind.Nu]: "ν",
	[DerivationKind.Xi]: "ξ",
	[DerivationKind.Seq]: "seq",
};

type IdDerivation = {
	rule: DerivationKind.Id;
	before?: undefined;
	after: Expression;
};

type BetaDerivation = {
	rule: DerivationKind.Beta;
	before: Expression;
	substituted: Expression;
	after: Expression;
	child: Derivation;
};

type MuDerivation = {
	rule: DerivationKind.Mu;
	before: Application;
	after: Application;
	child: Derivation;
};
type NuDerivation = {
	rule: DerivationKind.Nu;
	before: Application;
	after: Application;
	child: Derivation;
};

type XiDerivation = {
	rule: DerivationKind.Xi;
	before: Abstraction;
	after: Abstraction;
	child: Derivation;
};

type SeqDerivation = {
	rule: DerivationKind.Seq;
	before: Expression;
	after: Expression;
	children: Derivation[];
};

export type Derivation = IdDerivation | BetaDerivation | XiDerivation | MuDerivation | NuDerivation | SeqDerivation;

const id = (expr: Expression): IdDerivation => ({
	rule: DerivationKind.Id,
	after: expr,
});

const seq = (before: Expression, after: Expression, children: Derivation[]): SeqDerivation => ({
	rule: DerivationKind.Seq,
	before,
	after,
	children,
});

const isAppLeftLambda = (expr: Application): expr is Application & { left: Abstraction } =>
	ast.isAbstraction(expr.left);

const beta = (expr: Application & { left: Abstraction }, reduce: (expr: Expression) => Expression): Expression => {
	const substituted = shift(-1, 0, substitute(expr.left.body, 0, shift(1, 0, expr.right)));
	return reduce(substituted);
};

const betaDerive = (
	expr: Application & { left: Abstraction },
	reduce: (expr: Expression) => Derivation,
): BetaDerivation => {
	const substituted = shift(-1, 0, substitute(expr.left.body, 0, shift(1, 0, expr.right)));
	const child = reduce(substituted);
	return {
		rule: DerivationKind.Beta,
		before: expr,
		substituted,
		after: child.after,
		child,
	};
};

const mu = (expr: Application, reduce: (expr: Expression) => Expression): Application => {
	return ast.application(reduce(expr.left), expr.right);
};

const muDerive = (expr: Application, reduce: (expr: Expression) => Derivation): MuDerivation => {
	const child = reduce(expr.left);
	return {
		rule: DerivationKind.Mu,
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
		rule: DerivationKind.Nu,
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
		rule: DerivationKind.Xi,
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

function derivationToStringInner(depth: number, lines: string[], derivation: Derivation) {
	if (derivation.rule === DerivationKind.Id) {
		lines.push(
			DERIVATION_RULE_NAMES[DerivationKind.Id].padEnd(3).padStart(3 + 2 * depth, "-") +
				" = " +
				ast.toString(derivation.after),
		);
		return;
	}
	if (derivation.rule === DerivationKind.Seq) {
		for (let i = 0; i < derivation.children.length; i++) {
			derivationToStringInner(depth, lines, derivation.children[i]);
		}
		return;
	}
	lines.push(
		DERIVATION_RULE_NAMES[derivation.rule].padEnd(3).padStart(3 + 2 * depth, "-") +
			" > " +
			ast.toString(derivation.before),
	);
	if (derivation.rule === DerivationKind.Beta) {
		lines.push(
			`${DERIVATION_RULE_NAMES[derivation.rule]}*`.padEnd(3).padStart(3 + 2 * depth, "-") +
				" = " +
				ast.toString(derivation.substituted),
		);
	}
	derivationToStringInner(depth + 1, lines, derivation.child);
	lines.push(
		DERIVATION_RULE_NAMES[derivation.rule].padEnd(3).padStart(3 + 2 * depth, "-") +
			" < " +
			ast.toString(derivation.after),
	);
}

export const normalOrder = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Variable:
			return expr;
		case ast.ExpressionKind.Abstraction:
			return xi(expr, normalOrder);
		case ast.ExpressionKind.Application: {
			if (isAppLeftLambda(expr)) {
				return beta(expr, normalOrder);
			}
			const left = mu(expr, normalOrder);
			if (isAppLeftLambda(left)) {
				return beta(left, normalOrder);
			}
			return nu(left, normalOrder);
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
			if (isAppLeftLambda(expr)) {
				return betaDerive(expr, normalOrderDerive);
			}
			const left = muDerive(expr, normalOrderDerive);
			if (isAppLeftLambda(left.after)) {
				const post = betaDerive(left.after, normalOrderDerive);
				return seq(expr, post.after, [left, post]);
			}
			return nuDerive(left.after, normalOrderDerive);
		}
	}
};

export const callByName = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Variable:
		case ast.ExpressionKind.Abstraction:
			return expr;
		case ast.ExpressionKind.Application: {
			const left = mu(expr, callByName);
			if (isAppLeftLambda(left)) {
				return beta(left, callByName);
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
				const post = betaDerive(left.after, callByNameDerive);
				return seq(expr, post.after, [left, post]);
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
				return beta(right, callByValue);
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
				const post = betaDerive(right.after, callByValueDerive);
				return seq(expr, post.after, [left, right, post]);
			}
			return seq(expr, right.after, [left, right]);
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
				return beta(right, applicativeOrder);
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
				const post = betaDerive(right.after, applicativeOrderDerive);
				return seq(expr, post.after, [left, right, post]);
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
			if (isAppLeftLambda(expr)) {
				return beta(expr, headReduction);
			}
			const left = mu(expr, headReduction);
			if (isAppLeftLambda(left)) {
				return beta(left, headReduction);
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
			if (isAppLeftLambda(expr)) {
				return betaDerive(expr, headReductionDerive);
			}
			const left = muDerive(expr, headReductionDerive);
			if (isAppLeftLambda(left.after)) {
				const post = betaDerive(left.after, headReductionDerive);
				return seq(expr, post.after, [left, post]);
			}
			return left;
		}
	}
};
