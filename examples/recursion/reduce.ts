import { ast, elaborate, parser as p, reduce, renderDerivation } from "../../src/recursion";
import inputs from "./example-surface-strings";

const strategies: [(expr: ast.Expression) => reduce.Derivation, string][] = [
	[reduce.normalOrderDerive, "normal order"],
	[reduce.callByNameDerive, "call-by-name"],
	[reduce.callByValueDerive, "call-by-value"],
	[reduce.applicativeOrderDerive, "applicative"],
	[reduce.headReductionDerive, "head reduction"],
];
const parser = new p.Parser();
for (let i = 0; i < inputs.length; i++) {
	console.log("===");
	const parsed = parser.parse(inputs[i]);
	const { expr, names, free } = elaborate.surfaceToCore(parsed);
	console.log(ast.toString(expr));
	for (let j = 0; j < strategies.length; j++) {
		console.log("---");
		const [f, name] = strategies[j];
		console.log(name);
		try {
			console.log(renderDerivation.derivationToString(f(expr), names, free));
		} catch (e) {
			console.error(String(e));
		}
	}
}
