export const enum ExpressionKind {
	Unit,
	Int,
	Variable,
	Application,
	Abstraction,
	LetIn,
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
export type Variable = { kind: ExpressionKind.Variable; name: string };
export type Application = { kind: ExpressionKind.Application; left: Expression; right: Expression };
export type Abstraction = { kind: ExpressionKind.Abstraction; variable: string; body: Expression };
export type LetIn = { kind: ExpressionKind.LetIn; variable: string; expr: Expression; body: Expression };
export type Unary = { kind: ExpressionKind.Unary; op: UnaryOp; expr: Expression };
export type Binary = { kind: ExpressionKind.Binary; op: BinaryOp; left: Expression; right: Expression };

export type Expression = Unit | Int | Variable | Application | Abstraction | LetIn | Unary | Binary;

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

export function unary(op: UnaryOp, expr: Expression): Unary {
	return { kind: ExpressionKind.Unary, op, expr };
}

export function binary(op: BinaryOp, left: Expression, right: Expression): Binary {
	return { kind: ExpressionKind.Binary, op, left, right };
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
					return `(${left} + ${right})`;
				case BinaryOp.Sub:
					return `(${left} - ${right})`;
				case BinaryOp.Mul:
					return `(${left} * ${right})`;
			}
		}
	}
}
