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

function surfaceToCoreInner(names: Names, scope: string[], expr: surface.Expression): core.Expression {
	switch (expr.kind) {
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

function binderName(names: Names, scope: string[], binder: core.Abstraction): string {
	return freshName(scope, names.get(binder) ?? makeName(scope.length));
}

function coreToSurfaceInner(names: Names, scope: string[], expr: core.Expression): surface.Expression {
	switch (expr.kind) {
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
	}
}
