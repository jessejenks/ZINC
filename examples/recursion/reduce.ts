import { ast, elaborate, parser as p, reduce } from "../../src/recursion";
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
	if (i > 0) {
		console.log("===");
	}
	const parsed = parser.parse(inputs[i]);
	const { expr } = elaborate.surfaceToCore(parsed);
	console.log(ast.toString(expr));
	for (let j = 0; j < strategies.length; j++) {
		if (j > 0) {
			console.log("---");
		}
		const [f, name] = strategies[j];
		console.log(name);
		try {
			console.log(reduce.derivationToString(f(expr)));
		} catch (e) {
			console.error(String(e));
		}
	}
}
