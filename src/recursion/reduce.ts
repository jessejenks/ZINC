import type { Abstraction, Application, Binary, Bool, Expression, IfElse, Int, LetIn, Unary } from "./core";
import * as ast from "./core";

export function shift(i: number, c: number, expr: Expression): Expression {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Bool:
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
		case ast.ExpressionKind.LetIn:
			return ast.letIn(
				shift(i, c + (expr.isRecursive ? 1 : 0), expr.expr),
				shift(i, c + 1, expr.body),
				expr.isRecursive,
			);
		case ast.ExpressionKind.IfElse:
			return ast.ifElse(shift(i, c, expr.condition), shift(i, c, expr.consequence), shift(i, c, expr.alternative));
		case ast.ExpressionKind.Unary:
			return ast.unary(expr.op, shift(i, c, expr.expr));
		case ast.ExpressionKind.Binary:
			return ast.binary(expr.op, shift(i, c, expr.left), shift(i, c, expr.right));
	}
}

export function substitute(t: Expression, n: number, e: Expression): Expression {
	switch (t.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Bool:
		case ast.ExpressionKind.Int:
			return t;
		case ast.ExpressionKind.Variable:
			return t.index === n ? e : t;
		case ast.ExpressionKind.Application:
			return ast.application(substitute(t.left, n, e), substitute(t.right, n, e));
		case ast.ExpressionKind.Abstraction:
			return ast.abstraction(substitute(t.body, n + 1, shift(1, 0, e)));
		case ast.ExpressionKind.LetIn:
			return ast.letIn(
				t.isRecursive
					? substitute(t.expr, n + 1, shift(1, 0, e)) //
					: substitute(t.expr, n, e),
				substitute(t.body, n + 1, shift(1, 0, e)),
				t.isRecursive,
			);
		case ast.ExpressionKind.IfElse:
			return ast.ifElse(
				substitute(t.condition, n, e),
				substitute(t.consequence, n, e),
				substitute(t.alternative, n, e),
			);
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
	Zeta,
	Fix,
	Iota,
	Nu,
	Mu,
	Xi,
	LetBound,
	LetBody,
	IfCondition,
	IfConsequence,
	IfAlternative,
	Unary,
	Binary,
	Seq,
}

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
	after: Int | Bool;
};

export type NuDerivation = {
	rule: DerivationRule.Nu;
	before: Application;
	after: Application;
	child: Derivation;
};

export type MuDerivation = {
	rule: DerivationRule.Mu;
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

// let x = e in b => b[x := e]
export type ZetaDerivation = {
	rule: DerivationRule.Zeta;
	before: LetIn;
	after: Expression;
};

// let rec x = e in b => let x = e[x := let rec x = e in x] in b
// let rec x = e in x => e[x := let rec x = e in x]
export type FixDerivation = {
	rule: DerivationRule.Fix;
	before: LetIn;
	after: Expression;
};

// if true then a else b => a
// if false then a else b => b
export type IotaDerivation = {
	rule: DerivationRule.Iota;
	before: IfElse;
	after: Expression;
};

export type LetBoundDerivation = {
	rule: DerivationRule.LetBound;
	before: LetIn;
	after: LetIn;
	child: Derivation;
};

export type LetBodyDerivation = {
	rule: DerivationRule.LetBody;
	before: LetIn;
	after: LetIn;
	child: Derivation;
};

export type IfConditionDerivation = {
	rule: DerivationRule.IfCondition;
	before: IfElse;
	after: IfElse;
	child: Derivation;
};

export type IfConsequenceDerivation = {
	rule: DerivationRule.IfConsequence;
	before: IfElse;
	after: IfElse;
	child: Derivation;
};

export type IfAlternativeDerivation = {
	rule: DerivationRule.IfAlternative;
	before: IfElse;
	after: IfElse;
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
	| ZetaDerivation
	| FixDerivation
	| IotaDerivation
	| XiDerivation
	| NuDerivation
	| MuDerivation
	| LetBoundDerivation
	| LetBodyDerivation
	| IfConditionDerivation
	| IfConsequenceDerivation
	| IfAlternativeDerivation
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

const nu = (expr: Application, reduce: (expr: Expression) => Expression): Application => {
	return ast.application(reduce(expr.left), expr.right);
};

const nuDerive = (expr: Application, reduce: (expr: Expression) => Derivation): NuDerivation => {
	const child = reduce(expr.left);
	return {
		rule: DerivationRule.Nu,
		before: expr,
		after: ast.application(child.after, expr.right),
		child,
	};
};

const mu = (expr: Application, reduce: (expr: Expression) => Expression): Application => {
	return ast.application(expr.left, reduce(expr.right));
};

const muDerive = (expr: Application, reduce: (expr: Expression) => Derivation): MuDerivation => {
	const child = reduce(expr.right);
	return {
		rule: DerivationRule.Mu,
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

export const zetaStep = (expr: LetIn): Expression => betaStep(ast.abstraction(expr.body), expr.expr);

export const fixStep = (expr: LetIn): Expression => {
	const unfolded = betaStep(ast.abstraction(expr.expr), ast.letIn(expr.expr, ast.variable(0), true));
	if (ast.isVariable(expr.body) && expr.body.index === 0) {
		// skip let x = e in x => e
		return unfolded;
	}
	return ast.letIn(unfolded, expr.body, false);
};

const zetaDerive = (expr: LetIn): ZetaDerivation => ({
	rule: DerivationRule.Zeta,
	before: expr,
	after: zetaStep(expr),
});

const fixDerive = (expr: LetIn): FixDerivation => ({ rule: DerivationRule.Fix, before: expr, after: fixStep(expr) });

const letBoundDerive = (expr: LetIn, reduce: (expr: Expression) => Derivation): LetBoundDerivation => {
	const child = reduce(expr.expr);
	return {
		rule: DerivationRule.LetBound,
		before: expr,
		after: ast.letIn(child.after, expr.body, expr.isRecursive),
		child,
	};
};

const letBodyDerive = (expr: LetIn, reduce: (expr: Expression) => Derivation): LetBodyDerivation => {
	const child = reduce(expr.body);
	return {
		rule: DerivationRule.LetBody,
		before: expr,
		after: ast.letIn(expr.expr, child.after, expr.isRecursive),
		child,
	};
};

type LetOrder = { body: boolean; bound: boolean };

const letIn = (expr: LetIn, reduce: (expr: Expression) => Expression, order: LetOrder): Expression => {
	if (expr.isRecursive) {
		return reduce(fixStep(expr));
	}
	let current = expr;
	if (order.body) {
		current = ast.letIn(current.expr, reduce(current.body), false);
	}
	if (order.bound) {
		current = ast.letIn(reduce(current.expr), current.body, false);
	}
	return reduce(zetaStep(current));
};

const letInDerive = (expr: LetIn, reduce: (expr: Expression) => Derivation, order: LetOrder): Derivation => {
	if (expr.isRecursive) {
		const fix = fixDerive(expr);
		const post = reduce(fix.after);
		return seq(expr, post.after, [fix, post]);
	}
	const children: Derivation[] = [];
	let current = expr;
	if (order.body) {
		const body = letBodyDerive(current, reduce);
		children.push(body);
		current = body.after;
	}
	if (order.bound) {
		const bound = letBoundDerive(current, reduce);
		children.push(bound);
		current = bound.after;
	}
	const zeta = zetaDerive(current);
	const post = reduce(zeta.after);
	return seq(expr, post.after, [...children, zeta, post]);
};

const iotaDerive = (expr: IfElse & { condition: Bool }): IotaDerivation => ({
	rule: DerivationRule.Iota,
	before: expr,
	after: expr.condition.value ? expr.consequence : expr.alternative,
});

const conditional = (
	expr: IfElse,
	reduce: (expr: Expression) => Expression,
	reduceBranchesWhenStuck: boolean,
): Expression => {
	const condition = reduce(expr.condition);
	if (ast.isBool(condition)) {
		return reduce(condition.value ? expr.consequence : expr.alternative);
	}
	if (!reduceBranchesWhenStuck) {
		return ast.ifElse(condition, expr.consequence, expr.alternative);
	}
	return ast.ifElse(condition, reduce(expr.consequence), reduce(expr.alternative));
};

const conditionalDerive = (
	expr: IfElse,
	reduce: (expr: Expression) => Derivation,
	reduceBranchesWhenStuck: boolean,
): Derivation => {
	const conditionChild = reduce(expr.condition);
	const condition: IfConditionDerivation = {
		rule: DerivationRule.IfCondition,
		before: expr,
		after: ast.ifElse(conditionChild.after, expr.consequence, expr.alternative),
		child: conditionChild,
	};
	const current = condition.after;
	if (ast.isBool(current.condition)) {
		const iota = iotaDerive(current as IfElse & { condition: Bool });
		const post = reduce(iota.after);
		return seq(expr, post.after, [condition, iota, post]);
	}
	if (!reduceBranchesWhenStuck) {
		return condition;
	}
	const consequenceChild = reduce(current.consequence);
	const consequence: IfConsequenceDerivation = {
		rule: DerivationRule.IfConsequence,
		before: current,
		after: ast.ifElse(current.condition, consequenceChild.after, current.alternative),
		child: consequenceChild,
	};
	const alternativeChild = reduce(consequence.after.alternative);
	const alternative: IfAlternativeDerivation = {
		rule: DerivationRule.IfAlternative,
		before: consequence.after,
		after: ast.ifElse(current.condition, consequenceChild.after, alternativeChild.after),
		child: alternativeChild,
	};
	return seq(expr, alternative.after, [condition, consequence, alternative]);
};

const unary = (expr: Unary, reduce: (expr: Expression) => Expression): Unary | Bool | Int => {
	const child = reduce(expr.expr);
	switch (expr.op) {
		case ast.UnaryOp.Negate:
			if (ast.isInt(child)) {
				return ast.int(-child.value);
			}
			break;
		case ast.UnaryOp.BitNot:
			if (ast.isInt(child)) {
				return ast.int(~child.value);
			}
			break;
		case ast.UnaryOp.Not:
			if (ast.isBool(child)) {
				return ast.bool(!child.value);
			}
			break;
		default:
			expr.op satisfies never;
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
	let result: Int | Bool | undefined;
	switch (expr.op) {
		case ast.UnaryOp.Negate:
			if (ast.isInt(child.after)) {
				result = ast.int(-child.after.value);
			}
			break;
		case ast.UnaryOp.BitNot:
			if (ast.isInt(child.after)) {
				result = ast.int(~child.after.value);
			}
			break;
		case ast.UnaryOp.Not:
			if (ast.isBool(child.after)) {
				result = ast.bool(!child.after.value);
			}
			break;
		default:
			expr.op satisfies never;
	}
	if (result) {
		return seq(expr, result, [cong, { rule: DerivationRule.Delta, before: cong.after, after: result }]);
	}
	return cong;
};

const binary = (expr: Binary, reduce: (expr: Expression) => Expression): Binary | Bool | Int => {
	const left = reduce(expr.left);
	const right = reduce(expr.right);
	switch (expr.op) {
		case ast.BinaryOp.Add:
			if (ast.isInt(left) && ast.isInt(right)) {
				return ast.int(left.value + right.value);
			}
			break;
		case ast.BinaryOp.Sub:
			if (ast.isInt(left) && ast.isInt(right)) {
				return ast.int(left.value - right.value);
			}
			break;
		case ast.BinaryOp.Mul:
			if (ast.isInt(left) && ast.isInt(right)) {
				return ast.int(left.value * right.value);
			}
			break;
		case ast.BinaryOp.Div:
			if (ast.isInt(left) && ast.isInt(right)) {
				return ast.int(Math.trunc(left.value / right.value));
			}
			break;
		case ast.BinaryOp.Lt:
			if (ast.isInt(left) && ast.isInt(right)) {
				return ast.bool(left.value < right.value);
			}
			break;
		case ast.BinaryOp.Gt:
			if (ast.isInt(left) && ast.isInt(right)) {
				return ast.bool(left.value > right.value);
			}
			break;
		case ast.BinaryOp.Lte:
			if (ast.isInt(left) && ast.isInt(right)) {
				return ast.bool(left.value <= right.value);
			}
			break;
		case ast.BinaryOp.Gte:
			if (ast.isInt(left) && ast.isInt(right)) {
				return ast.bool(left.value >= right.value);
			}
			break;
		case ast.BinaryOp.Eq:
			if (ast.isInt(left) && ast.isInt(right)) {
				return ast.bool(left.value === right.value);
			}
			break;
		case ast.BinaryOp.BitAnd:
			if (ast.isInt(left) && ast.isInt(right)) {
				return ast.int(left.value & right.value);
			}
			break;
		case ast.BinaryOp.BitOr:
			if (ast.isInt(left) && ast.isInt(right)) {
				return ast.int(left.value | right.value);
			}
			break;
		case ast.BinaryOp.And:
			if (ast.isBool(left) && ast.isBool(right)) {
				return ast.bool(left.value && right.value);
			}
			break;
		case ast.BinaryOp.Or:
			if (ast.isBool(left) && ast.isBool(right)) {
				return ast.bool(left.value || right.value);
			}
			break;
		default:
			expr.op satisfies never;
	}
	return ast.binary(expr.op, left, right);
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

	let result: Int | Bool | undefined;
	switch (expr.op) {
		case ast.BinaryOp.Add:
			if (ast.isInt(left.after) && ast.isInt(right.after)) {
				result = ast.int(left.after.value + right.after.value);
			}
			break;
		case ast.BinaryOp.Sub:
			if (ast.isInt(left.after) && ast.isInt(right.after)) {
				result = ast.int(left.after.value - right.after.value);
			}
			break;
		case ast.BinaryOp.Mul:
			if (ast.isInt(left.after) && ast.isInt(right.after)) {
				result = ast.int(left.after.value * right.after.value);
			}
			break;
		case ast.BinaryOp.Div:
			if (ast.isInt(left.after) && ast.isInt(right.after)) {
				result = ast.int(Math.trunc(left.after.value / right.after.value));
			}
			break;
		case ast.BinaryOp.Lt:
			if (ast.isInt(left.after) && ast.isInt(right.after)) {
				result = ast.bool(left.after.value < right.after.value);
			}
			break;
		case ast.BinaryOp.Gt:
			if (ast.isInt(left.after) && ast.isInt(right.after)) {
				result = ast.bool(left.after.value > right.after.value);
			}
			break;
		case ast.BinaryOp.Lte:
			if (ast.isInt(left.after) && ast.isInt(right.after)) {
				result = ast.bool(left.after.value <= right.after.value);
			}
			break;
		case ast.BinaryOp.Gte:
			if (ast.isInt(left.after) && ast.isInt(right.after)) {
				result = ast.bool(left.after.value >= right.after.value);
			}
			break;
		case ast.BinaryOp.Eq:
			if (ast.isInt(left.after) && ast.isInt(right.after)) {
				result = ast.bool(left.after.value === right.after.value);
			}
			break;
		case ast.BinaryOp.BitAnd:
			if (ast.isInt(left.after) && ast.isInt(right.after)) {
				result = ast.int(left.after.value & right.after.value);
			}
			break;
		case ast.BinaryOp.BitOr:
			if (ast.isInt(left.after) && ast.isInt(right.after)) {
				result = ast.int(left.after.value | right.after.value);
			}
			break;
		case ast.BinaryOp.And:
			if (ast.isBool(left.after) && ast.isBool(right.after)) {
				result = ast.bool(left.after.value && right.after.value);
			}
			break;
		case ast.BinaryOp.Or:
			if (ast.isBool(left.after) && ast.isBool(right.after)) {
				result = ast.bool(left.after.value || right.after.value);
			}
			break;
		default:
			expr.op satisfies never;
	}
	if (result) {
		return seq(expr, result, [cong, { rule: DerivationRule.Delta, before: cong.after, after: result }]);
	}
	return cong;
};

export const callByName = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Bool:
		case ast.ExpressionKind.Int:
		case ast.ExpressionKind.Variable:
		case ast.ExpressionKind.Abstraction:
			return expr;
		case ast.ExpressionKind.Application: {
			const left = nu(expr, callByName);
			if (isAppLeftLambda(left)) {
				return callByName(beta(left));
			}
			return left;
		}
		case ast.ExpressionKind.LetIn:
			return letIn(expr, callByName, { body: false, bound: false });
		case ast.ExpressionKind.IfElse:
			return conditional(expr, callByName, false);
		case ast.ExpressionKind.Unary:
			return unary(expr, callByName);
		case ast.ExpressionKind.Binary:
			return binary(expr, callByName);
	}
};

export const callByNameDerive = (expr: Expression): Derivation => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Bool:
		case ast.ExpressionKind.Int:
		case ast.ExpressionKind.Variable:
		case ast.ExpressionKind.Abstraction:
			return id(expr);
		case ast.ExpressionKind.Application: {
			const left = nuDerive(expr, callByNameDerive);
			if (isAppLeftLambda(left.after)) {
				const b = betaDerive(left.after);
				const post = callByNameDerive(b.after);
				return seq(expr, post.after, [left, b, post]);
			}
			return left;
		}
		case ast.ExpressionKind.LetIn:
			return letInDerive(expr, callByNameDerive, { body: false, bound: false });
		case ast.ExpressionKind.IfElse:
			return conditionalDerive(expr, callByNameDerive, false);
		case ast.ExpressionKind.Unary:
			return unaryDerive(expr, callByNameDerive);
		case ast.ExpressionKind.Binary:
			return binaryDerive(expr, callByNameDerive);
	}
};

export const callByValue = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Bool:
		case ast.ExpressionKind.Int:
		case ast.ExpressionKind.Variable:
		case ast.ExpressionKind.Abstraction:
			return expr;
		case ast.ExpressionKind.Application: {
			const left = nu(expr, callByValue);
			const right = mu(left, callByValue);
			if (isAppLeftLambda(right)) {
				return callByValue(beta(right));
			}
			return right;
		}
		case ast.ExpressionKind.LetIn:
			return letIn(expr, callByValue, { body: false, bound: true });
		case ast.ExpressionKind.IfElse:
			return conditional(expr, callByValue, false);
		case ast.ExpressionKind.Unary:
			return unary(expr, callByValue);
		case ast.ExpressionKind.Binary:
			return binary(expr, callByValue);
	}
};

export const callByValueDerive = (expr: Expression): Derivation => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Bool:
		case ast.ExpressionKind.Int:
		case ast.ExpressionKind.Variable:
		case ast.ExpressionKind.Abstraction:
			return id(expr);
		case ast.ExpressionKind.Application: {
			const left = nuDerive(expr, callByValueDerive);
			const right = muDerive(left.after, callByValueDerive);
			if (isAppLeftLambda(right.after)) {
				const b = betaDerive(right.after);
				const post = callByValueDerive(b.after);
				return seq(expr, post.after, [left, right, b, post]);
			}
			return seq(expr, right.after, [left, right]);
		}
		case ast.ExpressionKind.LetIn:
			return letInDerive(expr, callByValueDerive, { body: false, bound: true });
		case ast.ExpressionKind.IfElse:
			return conditionalDerive(expr, callByValueDerive, false);
		case ast.ExpressionKind.Unary:
			return unaryDerive(expr, callByValueDerive);
		case ast.ExpressionKind.Binary:
			return binaryDerive(expr, callByValueDerive);
	}
};

export const normalOrder = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Bool:
		case ast.ExpressionKind.Int:
		case ast.ExpressionKind.Variable:
			return expr;
		case ast.ExpressionKind.Abstraction:
			return xi(expr, normalOrder);
		case ast.ExpressionKind.Application: {
			const left = nu(expr, callByName);
			if (isAppLeftLambda(left)) {
				return normalOrder(beta(left));
			}
			return mu(nu(left, normalOrder), normalOrder);
		}
		case ast.ExpressionKind.LetIn:
			return letIn(expr, normalOrder, { body: false, bound: false });
		case ast.ExpressionKind.IfElse:
			return conditional(expr, normalOrder, true);
		case ast.ExpressionKind.Unary:
			return unary(expr, normalOrder);
		case ast.ExpressionKind.Binary:
			return binary(expr, normalOrder);
	}
};

export const normalOrderDerive = (expr: Expression): Derivation => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Bool:
		case ast.ExpressionKind.Int:
		case ast.ExpressionKind.Variable:
			return id(expr);
		case ast.ExpressionKind.Abstraction:
			return xiDerive(expr, normalOrderDerive);
		case ast.ExpressionKind.Application: {
			const left = nuDerive(expr, callByNameDerive);
			if (isAppLeftLambda(left.after)) {
				const b = betaDerive(left.after);
				const post = normalOrderDerive(b.after);
				return seq(expr, post.after, [left, b, post]);
			}
			const l = nuDerive(left.after, normalOrderDerive);
			const r = muDerive(l.after, normalOrderDerive);
			return seq(expr, r.after, [left, l, r]);
		}
		case ast.ExpressionKind.LetIn:
			return letInDerive(expr, normalOrderDerive, { body: false, bound: false });
		case ast.ExpressionKind.IfElse:
			return conditionalDerive(expr, normalOrderDerive, true);
		case ast.ExpressionKind.Unary:
			return unaryDerive(expr, normalOrderDerive);
		case ast.ExpressionKind.Binary:
			return binaryDerive(expr, normalOrderDerive);
	}
};

export const applicativeOrder = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Bool:
		case ast.ExpressionKind.Int:
		case ast.ExpressionKind.Variable:
			return expr;
		case ast.ExpressionKind.Abstraction:
			return xi(expr, applicativeOrder);
		case ast.ExpressionKind.Application: {
			const left = nu(expr, applicativeOrder);
			const right = mu(left, applicativeOrder);
			if (isAppLeftLambda(right)) {
				return applicativeOrder(beta(right));
			}
			return right;
		}
		case ast.ExpressionKind.LetIn:
			return letIn(expr, applicativeOrder, { body: true, bound: true });
		case ast.ExpressionKind.IfElse:
			return conditional(expr, applicativeOrder, true);
		case ast.ExpressionKind.Unary:
			return unary(expr, applicativeOrder);
		case ast.ExpressionKind.Binary:
			return binary(expr, applicativeOrder);
	}
};

export const applicativeOrderDerive = (expr: Expression): Derivation => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Bool:
		case ast.ExpressionKind.Int:
		case ast.ExpressionKind.Variable:
			return id(expr);
		case ast.ExpressionKind.Abstraction:
			return xiDerive(expr, applicativeOrderDerive);
		case ast.ExpressionKind.Application: {
			const left = nuDerive(expr, applicativeOrderDerive);
			const right = muDerive(left.after, applicativeOrderDerive);
			if (isAppLeftLambda(right.after)) {
				const b = betaDerive(right.after);
				const post = applicativeOrderDerive(b.after);
				return seq(expr, post.after, [left, right, b, post]);
			}
			return seq(expr, right.after, [left, right]);
		}
		case ast.ExpressionKind.LetIn:
			return letInDerive(expr, applicativeOrderDerive, { body: true, bound: true });
		case ast.ExpressionKind.IfElse:
			return conditionalDerive(expr, applicativeOrderDerive, true);
		case ast.ExpressionKind.Unary:
			return unaryDerive(expr, applicativeOrderDerive);
		case ast.ExpressionKind.Binary:
			return binaryDerive(expr, applicativeOrderDerive);
	}
};

export const headReduction = (expr: Expression): Expression => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Bool:
		case ast.ExpressionKind.Int:
		case ast.ExpressionKind.Variable:
			return expr;
		case ast.ExpressionKind.Abstraction:
			return xi(expr, headReduction);
		case ast.ExpressionKind.Application: {
			const left = nu(expr, callByName);
			if (isAppLeftLambda(left)) {
				return headReduction(beta(left));
			}
			return left;
		}
		case ast.ExpressionKind.LetIn:
			return letIn(expr, headReduction, { body: false, bound: false });
		case ast.ExpressionKind.IfElse:
			return conditional(expr, headReduction, false);
		case ast.ExpressionKind.Unary:
			return unary(expr, headReduction);
		case ast.ExpressionKind.Binary:
			return binary(expr, headReduction);
	}
};

export const headReductionDerive = (expr: Expression): Derivation => {
	switch (expr.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Bool:
		case ast.ExpressionKind.Int:
		case ast.ExpressionKind.Variable:
			return id(expr);
		case ast.ExpressionKind.Abstraction:
			return xiDerive(expr, headReductionDerive);
		case ast.ExpressionKind.Application: {
			const left = nuDerive(expr, callByNameDerive);
			if (isAppLeftLambda(left.after)) {
				const b = betaDerive(left.after);
				const post = headReductionDerive(b.after);
				return seq(expr, post.after, [left, b, post]);
			}
			return left;
		}
		case ast.ExpressionKind.LetIn:
			return letInDerive(expr, headReductionDerive, { body: false, bound: false });
		case ast.ExpressionKind.IfElse:
			return conditionalDerive(expr, headReductionDerive, false);
		case ast.ExpressionKind.Unary:
			return unaryDerive(expr, headReductionDerive);
		case ast.ExpressionKind.Binary:
			return binaryDerive(expr, headReductionDerive);
	}
};
