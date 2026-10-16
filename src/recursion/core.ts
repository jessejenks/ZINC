export const enum ExpressionKind {
	Unit,
	Bool,
	Int,
	Variable,
	Application,
	Abstraction,
	LetIn,
	IfElse,
	Unary,
	Binary,
}

export const enum UnaryOp {
	Negate,
	BitNot,
	Not,
}

export const enum BinaryOp {
	Add,
	Sub,
	Mul,
	Div,
	Lt,
	Gt,
	Lte,
	Gte,
	Eq,
	BitAnd,
	BitOr,
	And,
	Or,
}

export type Unit = { kind: ExpressionKind.Unit };
export type Bool = { kind: ExpressionKind.Bool; value: boolean };
export type Int = { kind: ExpressionKind.Int; value: number };
export type Variable = { kind: ExpressionKind.Variable; index: number };
export type Application = { kind: ExpressionKind.Application; left: Expression; right: Expression };
export type Abstraction = { kind: ExpressionKind.Abstraction; body: Expression };
export type LetIn = { kind: ExpressionKind.LetIn; isRecursive: boolean; expr: Expression; body: Expression };
export type IfElse = {
	kind: ExpressionKind.IfElse;
	condition: Expression;
	consequence: Expression;
	alternative: Expression;
};
export type Unary = { kind: ExpressionKind.Unary; op: UnaryOp; expr: Expression };
export type Binary = { kind: ExpressionKind.Binary; op: BinaryOp; left: Expression; right: Expression };

export type Expression = Unit | Bool | Int | Variable | Application | Abstraction | LetIn | IfElse | Unary | Binary;

const UNIT: Unit = { kind: ExpressionKind.Unit };
export function unit(): Unit {
	return UNIT;
}

export function bool(value: boolean): Bool {
	return { kind: ExpressionKind.Bool, value };
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

export function letIn(expr: Expression, body: Expression, isRecursive: boolean): LetIn {
	return { kind: ExpressionKind.LetIn, expr, body, isRecursive };
}

export function ifElse(condition: Expression, consequence: Expression, alternative: Expression): IfElse {
	return { kind: ExpressionKind.IfElse, condition, consequence, alternative };
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

export function isBool(expression: Expression): expression is Bool {
	return expression.kind === ExpressionKind.Bool;
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

export function isLetIn(expression: Expression): expression is LetIn {
	return expression.kind === ExpressionKind.LetIn;
}

export function isIfElse(expression: Expression): expression is IfElse {
	return expression.kind === ExpressionKind.IfElse;
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
			return "()";
		case ExpressionKind.Bool:
			return expression.value ? "true" : "false";
		case ExpressionKind.Int:
			return expression.value.toString();
		case ExpressionKind.Variable:
			return `#${expression.index.toString()}`;
		case ExpressionKind.Application:
			return `(${toString(expression.left)} ${toString(expression.right)})`;
		case ExpressionKind.Abstraction:
			return `(λ.${toString(expression.body)})`;
		case ExpressionKind.LetIn:
			return `(let${expression.isRecursive ? " rec " : " "}${toString(expression.expr)} in ${toString(expression.body)})`;
		case ExpressionKind.IfElse:
			return `(if ${toString(expression.condition)} then ${toString(expression.consequence)} else ${toString(expression.alternative)})`;
		case ExpressionKind.Unary:
			switch (expression.op) {
				case UnaryOp.Negate:
					return `(- ${toString(expression.expr)})`;
				case UnaryOp.BitNot:
					return `(~ ${toString(expression.expr)})`;
				case UnaryOp.Not:
					return `(! ${toString(expression.expr)})`;
			}
		case ExpressionKind.Binary:
			switch (expression.op) {
				case BinaryOp.Add:
					return `(${toString(expression.left)} + ${toString(expression.right)})`;
				case BinaryOp.Sub:
					return `(${toString(expression.left)} - ${toString(expression.right)})`;
				case BinaryOp.Mul:
					return `(${toString(expression.left)} * ${toString(expression.right)})`;
				case BinaryOp.Div:
					return `(${toString(expression.left)} / ${toString(expression.right)})`;
				case BinaryOp.Lt:
					return `(${toString(expression.left)} < ${toString(expression.right)})`;
				case BinaryOp.Gt:
					return `(${toString(expression.left)} > ${toString(expression.right)})`;
				case BinaryOp.Lte:
					return `(${toString(expression.left)} <= ${toString(expression.right)})`;
				case BinaryOp.Gte:
					return `(${toString(expression.left)} >= ${toString(expression.right)})`;
				case BinaryOp.Eq:
					return `(${toString(expression.left)} == ${toString(expression.right)})`;
				case BinaryOp.BitAnd:
					return `(${toString(expression.left)} & ${toString(expression.right)})`;
				case BinaryOp.BitOr:
					return `(${toString(expression.left)} | ${toString(expression.right)})`;
				case BinaryOp.And:
					return `(${toString(expression.left)} && ${toString(expression.right)})`;
				case BinaryOp.Or:
					return `(${toString(expression.left)} || ${toString(expression.right)})`;
			}
	}
}
