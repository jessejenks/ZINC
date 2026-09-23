import { ast } from "../src";

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
export default terms;
