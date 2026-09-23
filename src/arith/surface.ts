export const enum ExpressionKind {
	Unit,
	Int,
	Variable,
	Application,
	Abstraction,
	LetIn,
	Negate,
	Add,
	Sub,
	Mul,
}

export type Unit = { kind: ExpressionKind.Unit };
export type Int = { kind: ExpressionKind.Int; value: number };
export type Variable = { kind: ExpressionKind.Variable; name: string };
export type Application = { kind: ExpressionKind.Application; left: Expression; right: Expression };
export type Abstraction = { kind: ExpressionKind.Abstraction; variable: string; body: Expression };
export type LetIn = { kind: ExpressionKind.LetIn; variable: string; expr: Expression; body: Expression };
export type Negate = { kind: ExpressionKind.Negate; expr: Expression };
export type Add = { kind: ExpressionKind.Add; left: Expression; right: Expression };
export type Sub = { kind: ExpressionKind.Sub; left: Expression; right: Expression };
export type Mul = { kind: ExpressionKind.Mul; left: Expression; right: Expression };

export type Expression = Unit | Int | Variable | Application | Abstraction | LetIn | Negate | Add | Sub | Mul;

const UNIT: Unit = { kind: ExpressionKind.Unit };
export function unit(): Unit {
	return UNIT;
}

export function int(value: number): Int {
	return { kind: ExpressionKind.Int, value };
}

export function variable(name: string): Variable {
	return { kind: ExpressionKind.Variable, name };
}

export function application(left: Expression, right: Expression): Application {
	return { kind: ExpressionKind.Application, left, right };
}

export function abstraction(variable: string, body: Expression): Abstraction {
	return { kind: ExpressionKind.Abstraction, variable, body };
}

export function letIn(variable: string, expr: Expression, body: Expression): LetIn {
	return { kind: ExpressionKind.LetIn, variable, expr, body };
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

export function toString(expression: Expression): string {
	switch (expression.kind) {
		case ExpressionKind.Unit:
			return "unit";
		case ExpressionKind.Int:
			return expression.value.toString();
		case ExpressionKind.Variable:
			return expression.name;
		case ExpressionKind.Application:
			return `(${toString(expression.left)} ${toString(expression.right)})`;
		case ExpressionKind.Abstraction:
			return `(λ${expression.variable}. ${toString(expression.body)})`;
		case ExpressionKind.LetIn:
			return `(let ${expression.variable} = ${toString(expression.expr)} in ${toString(expression.body)})`;
		case ExpressionKind.Negate:
			return `(- ${toString(expression.expr)})`;
		case ExpressionKind.Add:
			return `(${toString(expression.left)} + ${toString(expression.right)})`;
		case ExpressionKind.Sub:
			return `(${toString(expression.left)} - ${toString(expression.right)})`;
		case ExpressionKind.Mul:
			return `(${toString(expression.left)} * ${toString(expression.right)})`;
	}
}
