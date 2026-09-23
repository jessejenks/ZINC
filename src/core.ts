export const enum ExpressionKind {
	Variable,
	Application,
	Abstraction,
}

export type Variable = { kind: ExpressionKind.Variable; index: number };
export type Application = { kind: ExpressionKind.Application; left: Expression; right: Expression };
export type Abstraction = { kind: ExpressionKind.Abstraction; body: Expression };

export type Expression = Variable | Application | Abstraction;

export function variable(index: number): Variable {
	return { kind: ExpressionKind.Variable, index };
}

export function application(left: Expression, right: Expression): Application {
	return { kind: ExpressionKind.Application, left, right };
}

export function abstraction(body: Expression): Abstraction {
	return { kind: ExpressionKind.Abstraction, body };
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

export function toString(expression: Expression): string {
	switch (expression.kind) {
		case ExpressionKind.Variable:
			return expression.index.toString();
		case ExpressionKind.Application:
			return `(${toString(expression.left)} ${toString(expression.right)})`;
		case ExpressionKind.Abstraction:
			return `(λ ${toString(expression.body)})`;
	}
}
