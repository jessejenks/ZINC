import * as ast from "./core";
import type { Derivation } from "./reduce";
import { DerivationRule, fixArgument } from "./reduce";

export type Binder = ast.Abstraction | ast.LetIn;

export type Names = Map<Binder, string>;

export function copyName(names: Names, from: Binder, to: Binder) {
	const name = names.get(from);
	if (name !== undefined) names.set(to, name);
}

export function freshName(scope: readonly (string | null)[], name: string): string {
	while (scope.includes(name)) name += "'";
	return name;
}

function zipNames(names: Names, body: ast.Expression, out: ast.Expression, arg: ast.Expression | null, depth: number) {
	switch (body.kind) {
		case ast.ExpressionKind.Unit:
		case ast.ExpressionKind.Bool:
		case ast.ExpressionKind.Int:
			return;
		case ast.ExpressionKind.Variable:
			if (arg && body.index === depth) zipNames(names, arg, out, null, 0);
			return;
		case ast.ExpressionKind.Application: {
			const app = out as ast.Application;
			zipNames(names, body.left, app.left, arg, depth);
			zipNames(names, body.right, app.right, arg, depth);
			return;
		}
		case ast.ExpressionKind.Abstraction: {
			const abs = out as ast.Abstraction;
			copyName(names, body, abs);
			zipNames(names, body.body, abs.body, arg, depth + 1);
			return;
		}
		case ast.ExpressionKind.LetIn: {
			const letIn = out as ast.LetIn;
			copyName(names, body, letIn);
			zipNames(names, body.expr, letIn.expr, arg, body.isRecursive ? depth + 1 : depth);
			zipNames(names, body.body, letIn.body, arg, depth + 1);
			return;
		}
		case ast.ExpressionKind.IfElse: {
			const ifElse = out as ast.IfElse;
			zipNames(names, body.condition, ifElse.condition, arg, depth);
			zipNames(names, body.consequence, ifElse.consequence, arg, depth);
			zipNames(names, body.alternative, ifElse.alternative, arg, depth);
			return;
		}
		case ast.ExpressionKind.Unary:
			zipNames(names, body.expr, (out as ast.Unary).expr, arg, depth);
			return;
		case ast.ExpressionKind.Binary: {
			const bin = out as ast.Binary;
			zipNames(names, body.left, bin.left, arg, depth);
			zipNames(names, body.right, bin.right, arg, depth);
			return;
		}
		default:
			body satisfies never;
	}
}

function propagateNames(names: Names, d: Derivation) {
	switch (d.rule) {
		case DerivationRule.Id:
		case DerivationRule.Delta:
		case DerivationRule.Iota:
			return;
		case DerivationRule.Beta:
			zipNames(names, (d.before.left as ast.Abstraction).body, d.after, d.before.right, 0);
			return;
		case DerivationRule.Zeta:
			zipNames(names, d.before.body, d.after, d.before.expr, 0);
			return;
		case DerivationRule.Fix: {
			const arg = fixArgument(d.before);
			copyName(names, d.before, arg);
			if (ast.isVariable(d.before.body) && d.before.body.index === 0) {
				zipNames(names, d.before.expr, d.after, arg, 0);
				return;
			}
			const after = d.after as ast.LetIn;
			copyName(names, d.before, after);
			zipNames(names, d.before.expr, after.expr, arg, 0);
			return;
		}
		case DerivationRule.Xi:
		case DerivationRule.LetBound:
		case DerivationRule.LetBody:
			copyName(names, d.before, d.after);
			propagateNames(names, d.child);
			return;
		case DerivationRule.Nu:
		case DerivationRule.Mu:
		case DerivationRule.Unary:
		case DerivationRule.IfCondition:
		case DerivationRule.IfConsequence:
		case DerivationRule.IfAlternative:
			propagateNames(names, d.child);
			return;
		case DerivationRule.Binary:
		case DerivationRule.Seq:
			for (const child of d.children) propagateNames(names, child);
			return;
		default:
			d satisfies never;
	}
}

export function namesThrough(names: Names, derivation: Derivation): Names {
	const extended = new Map(names);
	propagateNames(extended, derivation);
	return extended;
}
