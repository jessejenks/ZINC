import { ast } from "../../src/arith";

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
	ast.unit(),
	ast.int(1),
	ast.add(ast.int(1), ast.int(2)),
	ast.add(ast.int(1), ast.unit()),
	ast.abstraction(ast.add(ast.variable(0), ast.int(1))),
	ast.application(ast.abstraction(ast.add(ast.variable(0), ast.int(1))), ast.int(2)),
];
export default terms;
