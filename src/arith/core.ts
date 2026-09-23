export const enum ExpressionKind {
	Unit,
	Int,
	Variable,
	Application,
	Abstraction,
	Negate,
	Add,
	Sub,
	Mul,
}

export type Unit = { kind: ExpressionKind.Unit };
export type Int = { kind: ExpressionKind.Int; value: number };
export type Variable = { kind: ExpressionKind.Variable; index: number };
export type Application = { kind: ExpressionKind.Application; left: Expression; right: Expression };
export type Abstraction = { kind: ExpressionKind.Abstraction; body: Expression };
export type Negate = { kind: ExpressionKind.Negate; expr: Expression };
export type Add = { kind: ExpressionKind.Add; left: Expression; right: Expression };
export type Sub = { kind: ExpressionKind.Sub; left: Expression; right: Expression };
export type Mul = { kind: ExpressionKind.Mul; left: Expression; right: Expression };

export type Expression = Unit | Int | Variable | Application | Abstraction | Negate | Add | Sub | Mul;

const UNIT: Unit = { kind: ExpressionKind.Unit };
export function unit(): Unit {
	return UNIT;
}

export function int(value: number): Int {
	return { kind: ExpressionKind.Int, value };
}

export function variable(index: number): Variable {
	return { kind: ExpressionKind.Variable, index };
}

export function application(left: Expression, right: Expression): Application {
	return { kind: ExpressionKind.Application, left, right };
}

export function abstraction(body: Expression): Abstraction {
	return { kind: ExpressionKind.Abstraction, body };
}

export function negate(expr: Expression): Negate {
	return { kind: ExpressionKind.Negate, expr };
}

export function add(left: Expression, right: Expression): Add {
	return { kind: ExpressionKind.Add, left, right };
}

export function sub(left: Expression, right: Expression): Sub {
	return { kind: ExpressionKind.Sub, left, right };
}

export function mul(left: Expression, right: Expression): Mul {
	return { kind: ExpressionKind.Mul, left, right };
}

export function isUnit(expression: Expression): expression is Unit {
	return expression.kind === ExpressionKind.Unit;
}

export function isInt(expression: Expression): expression is Int {
	return expression.kind === ExpressionKind.Int;
}

export function isVariable(expression: Expression): expression is Variable {
	return expression.kind === ExpressionKind.Variable;
}

export function isApplication(expression: Expression): expression is Application {
	return expression.kind === ExpressionKind.Application;
}

export function isAbstraction(expression: Expression): expression is Abstraction {
	return expression.kind === ExpressionKind.Abstraction;
}

export function isNegate(expression: Expression): expression is Negate {
	return expression.kind === ExpressionKind.Negate;
}

export function isAdd(expression: Expression): expression is Add {
	return expression.kind === ExpressionKind.Add;
}

export function isSub(expression: Expression): expression is Sub {
	return expression.kind === ExpressionKind.Sub;
}

export function isMul(expression: Expression): expression is Mul {
	return expression.kind === ExpressionKind.Mul;
}

export function toString(expression: Expression): string {
	switch (expression.kind) {
		case ExpressionKind.Unit:
			return "unit";
		case ExpressionKind.Int:
			return `(int ${expression.value.toString()})`;
		case ExpressionKind.Variable:
			return expression.index.toString();
		case ExpressionKind.Application:
			return `(${toString(expression.left)} ${toString(expression.right)})`;
		case ExpressionKind.Abstraction:
			return `(λ ${toString(expression.body)})`;
		case ExpressionKind.Negate:
			return `(- ${toString(expression.expr)})`;
		case ExpressionKind.Add:
			return `(+ ${toString(expression.left)} ${toString(expression.right)})`;
		case ExpressionKind.Sub:
			return `(- ${toString(expression.left)} ${toString(expression.right)})`;
		case ExpressionKind.Mul:
			return `(* ${toString(expression.left)} ${toString(expression.right)})`;
	}
}
