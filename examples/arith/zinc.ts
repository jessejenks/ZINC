import { ast, elaborate, parser, reduce, zinc } from "../../src/arith";
import surfaceStrings from "./example-surface-strings";
import coreTerms from "./example-terms";

const compiler = new zinc.Compiler();
const machine = new zinc.Machine();
function runTerm(term: ast.Expression) {
	console.log("=== call-by-value ===");
	console.log(ast.toString(term), "->", ast.toString(reduce.callByValue(term)));
	console.log("=== ZINC          ===");
	compiler.compile(term);
	compiler.printCompilation();
	machine.load(compiler.getInstructions());

	let didError = false;
	do {
		// uncomment to see env and stack
		// machine.debug();
		try {
			if (!machine.step()) {
				break;
			}
		} catch (e) {
			didError = true;
			if (e instanceof zinc.RuntimeError) {
				console.error("Error", e.message);
				break;
			} else {
				throw e;
			}
		}
	} while (true);

	if (!didError) {
		try {
			const finalExpr = machine.readback(compiler.getReadback());
			console.log(ast.toString(term), "->", ast.toString(finalExpr));
		} catch (e) {
			if (e instanceof zinc.RuntimeError) {
				console.error("Error", e.message);
			} else {
				throw e;
			}
		}
	}
}

for (let i = 0; i < coreTerms.length; i++) {
	if (i > 0) {
		console.log();
	}
	runTerm(coreTerms[i]);
}

const p = new parser.Parser();
for (let i = 0; i < surfaceStrings.length; i++) {
	if (i > 0) {
		console.log();
	}
	console.log("=== input         ===");
	console.log(surfaceStrings[i]);
	const term = elaborate.surfaceToCore(p.parse(surfaceStrings[i]));
	runTerm(term);
}
