import { ast, krivine, reduce } from "../src";

const terms: ast.Expression[] = [
	ast.abstraction(ast.variable(0)),
	ast.abstraction(ast.variable(1)),
	ast.application(
		ast.application(
			ast.abstraction(ast.abstraction(ast.variable(0))),
			ast.abstraction(ast.abstraction(ast.variable(0))),
		),
		ast.abstraction(ast.abstraction(ast.variable(1))),
	),
	ast.application(
		ast.application(
			ast.abstraction(ast.abstraction(ast.variable(1))),
			ast.abstraction(ast.abstraction(ast.variable(0))),
		),
		ast.abstraction(ast.abstraction(ast.variable(1))),
	),
	ast.application(
		ast.abstraction(ast.abstraction(ast.variable(1))),
		ast.application(
			ast.abstraction(ast.abstraction(ast.variable(0))),
			ast.abstraction(ast.abstraction(ast.variable(0))),
		),
	),
];

const compiler = new krivine.Compiler();
const machine = new krivine.Machine();
for (let i = 0; i < terms.length; i++) {
	if (i > 0) {
		console.log();
	}
	console.log("=== call-by-name ===");
	console.log(ast.toString(terms[i]), "->", ast.toString(reduce.callByName(terms[i])));
	console.log("=== Krivine      ===");
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
			if (e instanceof krivine.RuntimeError) {
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
			if (e instanceof krivine.RuntimeError) {
				console.error("Error", e.message);
			} else {
				throw e;
			}
		}
	}
}
