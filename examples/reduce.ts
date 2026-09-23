import { ast, reduce } from "../src";

const ZERO = ast.abstraction(ast.abstraction(ast.variable(0)));
const SUCC = ast.abstraction(
	ast.abstraction(
		ast.abstraction(
			ast.application(
				ast.variable(1),
				ast.application(ast.application(ast.variable(2), ast.variable(1)), ast.variable(0)),
			),
		),
	),
);

const expressions: ast.Expression[] = [
	ast.variable(0),
	ast.abstraction(ast.variable(0)),
	ast.application(ast.abstraction(ast.variable(0)), ast.abstraction(ast.variable(0))),
	ast.application(SUCC, ZERO),
];
const strategies: [(expr: ast.Expression) => reduce.Derivation, string][] = [
	[reduce.normalOrderDerive, "normal order"],
	[reduce.callByNameDerive, "call-by-name"],
	[reduce.callByValueDerive, "call-by-value"],
	[reduce.applicativeOrderDerive, "applicative"],
	[reduce.headReductionDerive, "head reduction"],
];
for (let i = 0; i < expressions.length; i++) {
	if (i > 0) {
		console.log("===");
	}
	for (let j = 0; j < strategies.length; j++) {
		if (j > 0) {
			console.log("---");
		}
		const [f, name] = strategies[j];
		console.log(name);
		console.log(reduce.derivationToString(f(expressions[i])));
	}
}
