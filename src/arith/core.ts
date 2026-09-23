export const enum ExpressionKind {
	Unit,
	Int,
	Variable,
	Application,
	Abstraction,
	Unary,
	Binary,
}

export const enum UnaryOp {
	Negate,
}

export const enum BinaryOp {
	Add,
	Sub,
	Mul,
}

export type Unit = { kind: ExpressionKind.Unit };
export type Int = { kind: ExpressionKind.Int; value: number };
export type Variable = { kind: ExpressionKind.Variable; index: number };
export type Application = { kind: ExpressionKind.Application; left: Expression; right: Expression };
export type Abstraction = { kind: ExpressionKind.Abstraction; body: Expression };
export type Unary = { kind: ExpressionKind.Unary; op: UnaryOp; expr: Expression };
export type Binary = { kind: ExpressionKind.Binary; op: BinaryOp; left: Expression; right: Expression };

export type Expression = Unit | Int | Variable | Application | Abstraction | Unary | Binary;

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

export function unary(op: UnaryOp, expr: Expression): Unary {
	return { kind: ExpressionKind.Unary, op, expr };
}

export function binary(op: BinaryOp, left: Expression, right: Expression): Binary {
	return { kind: ExpressionKind.Binary, op, left, right };
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

export function isUnary(expression: Expression): expression is Unary {
	return expression.kind === ExpressionKind.Unary;
}

export function isBinary(expression: Expression): expression is Binary {
	return expression.kind === ExpressionKind.Binary;
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
		case ExpressionKind.Unary:
			switch (expression.op) {
				case UnaryOp.Negate:
					return `(- ${toString(expression.expr)})`;
			}
		case ExpressionKind.Binary: {
			const left = toString(expression.left);
			const right = toString(expression.right);
			switch (expression.op) {
				case BinaryOp.Add:
					return `(+ ${left} ${right})`;
				case BinaryOp.Sub:
					return `(- ${left} ${right})`;
				case BinaryOp.Mul:
					return `(* ${left} ${right})`;
			}
		}
	}
}
