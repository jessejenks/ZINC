import type { Abstraction, Application, Binary, Expression, Int, Unary } from "./core";
import * as ast from "./core";

export function shift(i: number, c: number, expr: Expression): Expression {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Int:
			return expr;
		case ast.ExpressionKind.Variable:
			if (expr.index < c) {
				return expr;
			}
			return ast.variable(expr.index + i);
		case ast.ExpressionKind.Application:
			return ast.application(shift(i, c, expr.left), shift(i, c, expr.right));
		case ast.ExpressionKind.Abstraction:
			return ast.abstraction(shift(i, c + 1, expr.body));
		case ast.ExpressionKind.Unary:
			return ast.unary(expr.op, shift(i, c, expr.expr));
		case ast.ExpressionKind.Binary:
			return ast.binary(expr.op, shift(i, c, expr.left), shift(i, c, expr.right));
	}
}

export function substitute(t: Expression, n: number, e: Expression): Expression {
	switch (t.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Int:
			return t;
		case ast.ExpressionKind.Variable:
			return t.index === n ? e : t;
		case ast.ExpressionKind.Application:
			return ast.application(substitute(t.left, n, e), substitute(t.right, n, e));
		case ast.ExpressionKind.Abstraction:
			return ast.abstraction(substitute(t.body, n + 1, shift(1, 0, e)));
		case ast.ExpressionKind.Unary:
			return ast.unary(t.op, substitute(t.expr, n, e));
		case ast.ExpressionKind.Binary:
			return ast.binary(t.op, substitute(t.left, n, e), substitute(t.right, n, e));
	}
}

export const enum DerivationRule {
	Id,
	Beta,
	Delta,
	Mu,
	Nu,
	Xi,
	Unary,
	Binary,
	Seq,
}

export const DERIVATION_RULE_NAMES: Record<DerivationRule, string> = {
	[DerivationRule.Id]: "id",
	[DerivationRule.Beta]: "β",
	[DerivationRule.Delta]: "δ",
	[DerivationRule.Mu]: "μ",
	[DerivationRule.Nu]: "ν",
	[DerivationRule.Xi]: "ξ",
	[DerivationRule.Unary]: "",
	[DerivationRule.Binary]: "",
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

export type DeltaDerivation = {
	rule: DerivationRule.Delta;
	before: Expression;
	after: Int;
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

export type UnaryDerivation = {
	rule: DerivationRule.Unary;
	before: Unary;
	after: Unary;
	child: Derivation;
};

export type BinaryDerivation = {
	rule: DerivationRule.Binary;
	before: Binary;
	after: Binary;
	children: [Derivation, Derivation];
};

export type SeqDerivation = {
	rule: DerivationRule.Seq;
	before: Expression;
	after: Expression;
	children: Derivation[];
};

export type Derivation =
	| IdDerivation
	| BetaDerivation
	| DeltaDerivation
	| XiDerivation
	| MuDerivation
	| NuDerivation
	| UnaryDerivation
	| BinaryDerivation
	| SeqDerivation;

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

const unary = (expr: Unary, reduce: (expr: Expression) => Expression): Unary | Int => {
	const child = reduce(expr.expr);
	if (ast.isInt(child)) {
		return ast.int(-child.value);
	}
	return ast.unary(expr.op, child);
};

const unaryDerive = (expr: Unary, reduce: (expr: Expression) => Derivation): UnaryDerivation | SeqDerivation => {
	const child = reduce(expr.expr);
	const cong: UnaryDerivation = {
		rule: DerivationRule.Unary,
		before: expr,
		after: ast.unary(expr.op, child.after),
		child,
	};
	if (ast.isInt(child.after)) {
		switch (expr.op) {
			case ast.UnaryOp.Negate: {
				const result = ast.int(-child.after.value);
				return seq(expr, result, [cong, { rule: DerivationRule.Delta, before: cong.after, after: result }]);
			}
		}
	}
	return cong;
};

const binary = (expr: Binary, reduce: (expr: Expression) => Expression): Binary | Int => {
	const leftChild = reduce(expr.left);
	const rightChild = reduce(expr.right);
	if (ast.isInt(leftChild) && ast.isInt(rightChild)) {
		switch (expr.op) {
			case ast.BinaryOp.Add:
				return ast.int(leftChild.value + rightChild.value);
			case ast.BinaryOp.Sub:
				return ast.int(leftChild.value - rightChild.value);
			case ast.BinaryOp.Mul:
				return ast.int(leftChild.value * rightChild.value);
		}
	}
	return ast.binary(expr.op, leftChild, rightChild);
};

const binaryDerive = (expr: Binary, reduce: (expr: Expression) => Derivation): BinaryDerivation | SeqDerivation => {
	const left = reduce(expr.left);
	const right = reduce(expr.right);
	const cong: BinaryDerivation = {
		rule: DerivationRule.Binary,
		before: expr,
		after: ast.binary(expr.op, left.after, right.after),
		children: [left, right],
	};
	if (ast.isInt(left.after) && ast.isInt(right.after)) {
		let result: Int;
		switch (expr.op) {
			case ast.BinaryOp.Add:
				result = ast.int(left.after.value + right.after.value);
				break;
			case ast.BinaryOp.Sub:
				result = ast.int(left.after.value - right.after.value);
				break;
			case ast.BinaryOp.Mul:
				result = ast.int(left.after.value * right.after.value);
				break;
		}
		return seq(expr, result, [cong, { rule: DerivationRule.Delta, before: cong.after, after: result }]);
	}
	return cong;
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
	if (derivation.rule === DerivationRule.Beta || derivation.rule === DerivationRule.Delta) {
		lines.push(prefix + " > " + ast.toString(derivation.before));
		lines.push(prefix + " < " + ast.toString(derivation.after));
		return;
	}
	if (derivation.rule === DerivationRule.Binary) {
		lines.push(prefix + " > " + ast.toString(derivation.before));
		for (let i = 0; i < derivation.children.length; i++) {
			if (derivation.children[i].rule === DerivationRule.Id) continue;
			derivationToStringInner(depth + 1, lines, derivation.children[i]);
		}
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
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Int:
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
		case ast.ExpressionKind.Unary:
			return unary(expr, callByName);
		case ast.ExpressionKind.Binary:
			return binary(expr, callByName);
	}
};

export const callByNameDerive = (expr: Expression): Derivation => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Int:
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
		case ast.ExpressionKind.Unary:
			return unaryDerive(expr, callByNameDerive);
		case ast.ExpressionKind.Binary:
			return binaryDerive(expr, callByNameDerive);
	}
};

export const callByValue = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Int:
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
		case ast.ExpressionKind.Unary:
			return unary(expr, callByValue);
		case ast.ExpressionKind.Binary:
			return binary(expr, callByValue);
	}
};

export const callByValueDerive = (expr: Expression): Derivation => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Int:
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
		case ast.ExpressionKind.Unary:
			return unaryDerive(expr, callByValueDerive);
		case ast.ExpressionKind.Binary:
			return binaryDerive(expr, callByValueDerive);
	}
};

export const normalOrder = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Int:
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
		case ast.ExpressionKind.Unary:
			return unary(expr, normalOrder);
		case ast.ExpressionKind.Binary:
			return binary(expr, normalOrder);
	}
};

export const normalOrderDerive = (expr: Expression): Derivation => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Int:
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
		case ast.ExpressionKind.Unary:
			return unaryDerive(expr, normalOrderDerive);
		case ast.ExpressionKind.Binary:
			return binaryDerive(expr, normalOrderDerive);
	}
};

export const applicativeOrder = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Int:
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
		case ast.ExpressionKind.Unary:
			return unary(expr, applicativeOrder);
		case ast.ExpressionKind.Binary:
			return binary(expr, applicativeOrder);
	}
};

export const applicativeOrderDerive = (expr: Expression): Derivation => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Int:
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
		case ast.ExpressionKind.Unary:
			return unaryDerive(expr, applicativeOrderDerive);
		case ast.ExpressionKind.Binary:
			return binaryDerive(expr, applicativeOrderDerive);
	}
};

export const headReduction = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Int:
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
		case ast.ExpressionKind.Unary:
			return unary(expr, headReduction);
		case ast.ExpressionKind.Binary:
			return binary(expr, headReduction);
	}
};

export const headReductionDerive = (expr: Expression): Derivation => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Int:
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
		case ast.ExpressionKind.Unary:
			return unaryDerive(expr, headReductionDerive);
		case ast.ExpressionKind.Binary:
			return binaryDerive(expr, headReductionDerive);
	}
};
