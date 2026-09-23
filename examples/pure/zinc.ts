import { ast, reduce, zinc } from "../../src/pure";
import terms from "./example-terms";

const compiler = new zinc.Compiler();
const machine = new zinc.Machine();
for (let i = 0; i < terms.length; i++) {
	if (i > 0) {
		console.log();
	}
	console.log("=== call-by-value ===");
	console.log(ast.toString(terms[i]), "->", ast.toString(reduce.callByValue(terms[i])));
	console.log("=== ZINC          ===");
	compiler.compile(terms[i]);
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
			console.log(ast.toString(terms[i]), "->", ast.toString(finalExpr));
		} catch (e) {
			if (e instanceof zinc.RuntimeError) {
				console.error("Error", e.message);
			} else {
				throw e;
			}
		}
	}
}
