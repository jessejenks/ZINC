import * as core from "./core";
import type { Names } from "./names";
import { freshName } from "./names";
import * as surface from "./surface";

export type Elaborated = {
	expr: core.Expression;
	names: Names;
	free: string[]; // outermost first
};

export function surfaceToCore(expr: surface.Expression): Elaborated {
	const names: Names = new Map();
	const scope: string[] = [];
	return { expr: surfaceToCoreInner(names, scope, expr), names, free: scope };
}

const SURFACE_TO_CORE_UNOP: Record<surface.UnaryOp, core.UnaryOp> = {
	[surface.UnaryOp.Negate]: core.UnaryOp.Negate,
	[surface.UnaryOp.BitNot]: core.UnaryOp.BitNot,
	[surface.UnaryOp.Not]: core.UnaryOp.Not,
};

const SURFACE_TO_CORE_BINOP: Record<surface.BinaryOp, core.BinaryOp> = {
	[surface.BinaryOp.Add]: core.BinaryOp.Add,
	[surface.BinaryOp.Sub]: core.BinaryOp.Sub,
	[surface.BinaryOp.Mul]: core.BinaryOp.Mul,
	[surface.BinaryOp.Div]: core.BinaryOp.Div,
	[surface.BinaryOp.Lt]: core.BinaryOp.Lt,
	[surface.BinaryOp.Gt]: core.BinaryOp.Gt,
	[surface.BinaryOp.Lte]: core.BinaryOp.Lte,
	[surface.BinaryOp.Gte]: core.BinaryOp.Gte,
	[surface.BinaryOp.Eq]: core.BinaryOp.Eq,
	[surface.BinaryOp.BitAnd]: core.BinaryOp.BitAnd,
	[surface.BinaryOp.BitOr]: core.BinaryOp.BitOr,
	[surface.BinaryOp.And]: core.BinaryOp.And,
	[surface.BinaryOp.Or]: core.BinaryOp.Or,
};

function surfaceToCoreInner(names: Names, scope: string[], expr: surface.Expression): core.Expression {
	switch (expr.kind) {
		case surface.ExpressionKind.Unit:
			return core.unit();
		case surface.ExpressionKind.Bool:
			return core.bool(expr.value);
		case surface.ExpressionKind.Int:
			return core.int(expr.value);
		case surface.ExpressionKind.Variable: {
			let idx = scope.lastIndexOf(expr.name);
			if (idx < 0) {
				scope.unshift(expr.name);
				idx = 0;
			}
			return core.variable(scope.length - 1 - idx);
		}
		case surface.ExpressionKind.Application:
			return core.application(
				surfaceToCoreInner(names, scope, expr.left),
				surfaceToCoreInner(names, scope, expr.right),
			);
		case surface.ExpressionKind.Abstraction: {
			scope.push(expr.variable);
			const term = core.abstraction(surfaceToCoreInner(names, scope, expr.body));
			scope.pop();
			names.set(term, expr.variable);
			return term;
		}
		case surface.ExpressionKind.LetIn: {
			let term: core.LetIn;
			if (expr.isRecursive) {
				scope.push(expr.variable);
				const exprInner = surfaceToCoreInner(names, scope, expr.expr);
				const body = surfaceToCoreInner(names, scope, expr.body);
				scope.pop();
				term = core.letIn(exprInner, body, expr.isRecursive);
			} else {
				const exprInner = surfaceToCoreInner(names, scope, expr.expr);
				scope.push(expr.variable);
				const body = surfaceToCoreInner(names, scope, expr.body);
				scope.pop();
				term = core.letIn(exprInner, body, expr.isRecursive);
			}
			names.set(term, expr.variable);
			return term;
		}
		case surface.ExpressionKind.IfElse:
			return core.ifElse(
				surfaceToCoreInner(names, scope, expr.condition),
				surfaceToCoreInner(names, scope, expr.consequence),
				surfaceToCoreInner(names, scope, expr.alternative),
			);
		case surface.ExpressionKind.Unary:
			return core.unary(SURFACE_TO_CORE_UNOP[expr.op], surfaceToCoreInner(names, scope, expr.expr));
		case surface.ExpressionKind.Binary:
			return core.binary(
				SURFACE_TO_CORE_BINOP[expr.op],
				surfaceToCoreInner(names, scope, expr.left),
				surfaceToCoreInner(names, scope, expr.right),
			);
	}
}

function makeName(i: number): string {
	if (i < 0 || i > 51) {
		throw new Error("Too many names!");
	}
	if (i < 26) {
		return String.fromCharCode(97 + ((i + 23) % 26));
	}
	return String.fromCharCode(65 + ((i - 3) % 26));
}

export function coreToSurface(
	expr: core.Expression,
	names: Names = new Map(),
	free: string[] = [],
): surface.Expression {
	return coreToSurfaceInner(names, [...free], expr);
}

function binderName(names: Names, scope: string[], binder: core.Abstraction | core.LetIn): string {
	return freshName(scope, names.get(binder) ?? makeName(scope.length));
}

const CORE_TO_SURFACE_UNOP: Record<core.UnaryOp, surface.UnaryOp> = {
	[core.UnaryOp.Negate]: surface.UnaryOp.Negate,
	[core.UnaryOp.BitNot]: surface.UnaryOp.BitNot,
	[core.UnaryOp.Not]: surface.UnaryOp.Not,
};

const CORE_TO_SURFACE_BINOP: Record<core.BinaryOp, surface.BinaryOp> = {
	[core.BinaryOp.Add]: surface.BinaryOp.Add,
	[core.BinaryOp.Sub]: surface.BinaryOp.Sub,
	[core.BinaryOp.Mul]: surface.BinaryOp.Mul,
	[core.BinaryOp.Div]: surface.BinaryOp.Div,
	[core.BinaryOp.Lt]: surface.BinaryOp.Lt,
	[core.BinaryOp.Gt]: surface.BinaryOp.Gt,
	[core.BinaryOp.Lte]: surface.BinaryOp.Lte,
	[core.BinaryOp.Gte]: surface.BinaryOp.Gte,
	[core.BinaryOp.Eq]: surface.BinaryOp.Eq,
	[core.BinaryOp.BitAnd]: surface.BinaryOp.BitAnd,
	[core.BinaryOp.BitOr]: surface.BinaryOp.BitOr,
	[core.BinaryOp.And]: surface.BinaryOp.And,
	[core.BinaryOp.Or]: surface.BinaryOp.Or,
};

function coreToSurfaceInner(names: Names, scope: string[], expr: core.Expression): surface.Expression {
	switch (expr.kind) {
		case core.ExpressionKind.Unit:
			return surface.unit();
		case core.ExpressionKind.Bool:
			return surface.bool(expr.value);
		case core.ExpressionKind.Int:
			return surface.int(expr.value);
		case core.ExpressionKind.Variable:
			return surface.variable(scope[scope.length - 1 - expr.index] ?? makeName(scope.length - 1 - expr.index));
		case core.ExpressionKind.Application:
			return surface.application(
				coreToSurfaceInner(names, scope, expr.left),
				coreToSurfaceInner(names, scope, expr.right),
			);
		case core.ExpressionKind.Abstraction: {
			const name = binderName(names, scope, expr);
			return surface.abstraction(name, coreToSurfaceInner(names, [...scope, name], expr.body));
		}
		case core.ExpressionKind.LetIn: {
			const name = binderName(names, scope, expr);
			const inner = [...scope, name];
			return surface.letIn(
				name,
				coreToSurfaceInner(names, expr.isRecursive ? inner : scope, expr.expr),
				coreToSurfaceInner(names, inner, expr.body),
				expr.isRecursive,
			);
		}
		case core.ExpressionKind.IfElse:
			return surface.ifElse(
				coreToSurfaceInner(names, scope, expr.condition),
				coreToSurfaceInner(names, scope, expr.consequence),
				coreToSurfaceInner(names, scope, expr.alternative),
			);
		case core.ExpressionKind.Unary:
			return surface.unary(CORE_TO_SURFACE_UNOP[expr.op], coreToSurfaceInner(names, scope, expr.expr));
		case core.ExpressionKind.Binary:
			return surface.binary(
				CORE_TO_SURFACE_BINOP[expr.op],
				coreToSurfaceInner(names, scope, expr.left),
				coreToSurfaceInner(names, scope, expr.right),
			);
	}
}
