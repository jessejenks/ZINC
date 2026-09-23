export const enum ExpressionKind {
	Variable,
	Application,
	Abstraction,
}

export type Variable = { kind: ExpressionKind.Variable; name: string };
export type Application = { kind: ExpressionKind.Application; left: Expression; right: Expression };
export type Abstraction = { kind: ExpressionKind.Abstraction; variable: string; body: Expression };

export type Expression = Variable | Application | Abstraction;

export function variable(name: string): Variable {
	return { kind: ExpressionKind.Variable, name };
}

export function application(left: Expression, right: Expression): Application {
	return { kind: ExpressionKind.Application, left, right };
}

export function abstraction(variable: string, body: Expression): Abstraction {
	return { kind: ExpressionKind.Abstraction, variable, body };
}

export function toString(expression: Expression): string {
	switch (expression.kind) {
		case ExpressionKind.Variable:
			return expression.name;
		case ExpressionKind.Application:
			return `(${toString(expression.left)} ${toString(expression.right)})`;
		case ExpressionKind.Abstraction:
			return `(λ${expression.variable}. ${toString(expression.body)})`;
	}
}
