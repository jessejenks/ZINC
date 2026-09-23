import * as core from "./core";
import * as surface from "./surface";

export function surfaceToCore(expr: surface.Expression): core.Expression {
	const names: string[] = [];
	return surfaceToCoreInner(names, expr);
}

function surfaceToCoreInner(names: string[], expr: surface.Expression): core.Expression {
	switch (expr.kind) {
		case surface.ExpressionKind.Unit:
			return core.unit();
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
			names.push(expr.variable);
			const left = core.abstraction(surfaceToCoreInner(names, expr.body));
			names.pop();
			const right = surfaceToCoreInner(names, expr.expr);
			return core.application(left, right);
		}
		case surface.ExpressionKind.Negate:
			return core.negate(surfaceToCoreInner(names, expr.expr));
		case surface.ExpressionKind.Add:
			return core.add(surfaceToCoreInner(names, expr.left), surfaceToCoreInner(names, expr.right));
		case surface.ExpressionKind.Sub:
			return core.sub(surfaceToCoreInner(names, expr.left), surfaceToCoreInner(names, expr.right));
		case surface.ExpressionKind.Mul:
			return core.mul(surfaceToCoreInner(names, expr.left), surfaceToCoreInner(names, expr.right));
	}
}

function makeName(i: number): string {
	if (i < 0 || i > 51) {
		throw new Error("too many names!");
	}
	if (i < 26) {
		return String.fromCharCode(97 + ((i + 23) % 26));
	}
	return String.fromCharCode(65 + ((i - 3) % 26));
}

export function coreToSurface(expr: core.Expression): surface.Expression {
	return coreToSurfaceInner(0, expr);
}

function coreToSurfaceInner(nameIndex: number, expr: core.Expression): surface.Expression {
	switch (expr.kind) {
		case core.ExpressionKind.Unit:
			return surface.unit();
		case core.ExpressionKind.Int:
			return surface.int(expr.value);
		case core.ExpressionKind.Variable:
			return surface.variable(makeName(nameIndex - 1 - expr.index));
		case core.ExpressionKind.Application:
			return surface.application(coreToSurfaceInner(nameIndex, expr.left), coreToSurfaceInner(nameIndex, expr.right));
		case core.ExpressionKind.Abstraction:
			return surface.abstraction(makeName(nameIndex), coreToSurfaceInner(nameIndex + 1, expr.body));
		case core.ExpressionKind.Negate:
			return surface.negate(coreToSurfaceInner(nameIndex, expr.expr));
		case core.ExpressionKind.Add:
			return surface.add(coreToSurfaceInner(nameIndex, expr.left), coreToSurfaceInner(nameIndex, expr.right));
		case core.ExpressionKind.Sub:
			return surface.sub(coreToSurfaceInner(nameIndex, expr.left), coreToSurfaceInner(nameIndex, expr.right));
		case core.ExpressionKind.Mul:
			return surface.mul(coreToSurfaceInner(nameIndex, expr.left), coreToSurfaceInner(nameIndex, expr.right));
	}
}
