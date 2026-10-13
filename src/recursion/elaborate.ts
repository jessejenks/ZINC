import * as core from "./core";
import * as surface from "./surface";

export function surfaceToCore(expr: surface.Expression): core.Expression {
	const names: string[] = [];
	return surfaceToCoreInner(names, expr);
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

function surfaceToCoreInner(names: string[], expr: surface.Expression): core.Expression {
	switch (expr.kind) {
		case surface.ExpressionKind.Unit:
			return core.unit();
		case surface.ExpressionKind.Bool:
			return core.bool(expr.value);
		case surface.ExpressionKind.Int:
			return core.int(expr.value);
		case surface.ExpressionKind.Variable: {
			const idx = names.lastIndexOf(expr.name);
			if (idx < 0) {
				return core.variable(Number.MAX_SAFE_INTEGER);
			}
			return core.variable(names.length - 1 - idx);
		}
		case surface.ExpressionKind.Application:
			return core.application(surfaceToCoreInner(names, expr.left), surfaceToCoreInner(names, expr.right));
		case surface.ExpressionKind.Abstraction: {
			names.push(expr.variable);
			const term = core.abstraction(surfaceToCoreInner(names, expr.body));
			names.pop();
			return term;
		}
		case surface.ExpressionKind.LetIn: {
			if (expr.isRecursive) {
				names.push(expr.variable);
				const exprInner = surfaceToCoreInner(names, expr.expr);
				const body = surfaceToCoreInner(names, expr.body);
				names.pop();
				return core.letIn(exprInner, body, expr.isRecursive);
			} else {
				const exprInner = surfaceToCoreInner(names, expr.expr);
				names.push(expr.variable);
				const body = surfaceToCoreInner(names, expr.body);
				names.pop();
				return core.letIn(exprInner, body, expr.isRecursive);
			}
		}
		case surface.ExpressionKind.IfElse:
			return core.ifElse(
				surfaceToCoreInner(names, expr.condition),
				surfaceToCoreInner(names, expr.consequence),
				surfaceToCoreInner(names, expr.alternative),
			);
		case surface.ExpressionKind.Unary:
			return core.unary(SURFACE_TO_CORE_UNOP[expr.op], surfaceToCoreInner(names, expr.expr));
		case surface.ExpressionKind.Binary:
			return core.binary(
				SURFACE_TO_CORE_BINOP[expr.op],
				surfaceToCoreInner(names, expr.left),
				surfaceToCoreInner(names, expr.right),
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

export function coreToSurface(expr: core.Expression): surface.Expression {
	return coreToSurfaceInner(0, expr);
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

function coreToSurfaceInner(nameIndex: number, expr: core.Expression): surface.Expression {
	switch (expr.kind) {
		case core.ExpressionKind.Unit:
			return surface.unit();
		case core.ExpressionKind.Bool:
			return surface.bool(expr.value);
		case core.ExpressionKind.Int:
			return surface.int(expr.value);
		case core.ExpressionKind.Variable:
			return surface.variable(makeName(nameIndex - 1 - expr.index));
		case core.ExpressionKind.Application:
			return surface.application(coreToSurfaceInner(nameIndex, expr.left), coreToSurfaceInner(nameIndex, expr.right));
		case core.ExpressionKind.Abstraction:
			return surface.abstraction(makeName(nameIndex), coreToSurfaceInner(nameIndex + 1, expr.body));
		case core.ExpressionKind.LetIn:
			return surface.letIn(
				makeName(nameIndex),
				coreToSurfaceInner(nameIndex + (expr.isRecursive ? 1 : 0), expr.expr),
				coreToSurfaceInner(nameIndex + 1, expr.body),
				expr.isRecursive,
			);
		case core.ExpressionKind.IfElse:
			return surface.ifElse(
				coreToSurfaceInner(nameIndex, expr.condition),
				coreToSurfaceInner(nameIndex, expr.consequence),
				coreToSurfaceInner(nameIndex, expr.alternative),
			);
		case core.ExpressionKind.Unary:
			return surface.unary(CORE_TO_SURFACE_UNOP[expr.op], coreToSurfaceInner(nameIndex, expr.expr));
		case core.ExpressionKind.Binary:
			return surface.binary(
				CORE_TO_SURFACE_BINOP[expr.op],
				coreToSurfaceInner(nameIndex, expr.left),
				coreToSurfaceInner(nameIndex, expr.right),
			);
	}
}
