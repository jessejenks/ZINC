import { deepStrictEqual } from "node:assert";
import test, { suite } from "node:test";
import { ast, reduce } from "../../src/pure";

const { variable: v, application: app, abstraction: abs } = ast;

const I = abs(v(0));
const K = abs(abs(v(1)));
const S = abs(abs(abs(app(app(v(2), v(0)), app(v(1), v(0))))));

const ZERO = abs(abs(v(0)));
const SUCC = abs(abs(abs(app(v(1), app(app(v(2), v(1)), v(0))))));
const ONE = abs(abs(app(v(1), v(0))));
const ADD = abs(abs(abs(abs(app(app(v(3), v(1)), app(app(v(2), v(1)), v(0)))))));

const TRUE = abs(abs(v(1)));
const FALSE = abs(abs(v(0)));
// λp.λa.λb. p b a
// (λ (λ (λ ((2 0) 1))))
const NOT = abs(abs(abs(app(app(v(2), v(0)), v(1)))));
// λp.λq.λa.λb. p (q a b) b
const AND = abs(abs(abs(abs(app(app(v(3), app(app(v(2), v(1)), v(0))), v(0))))));
// λp.λq.λa.λb. p a (q a b)
const OR = abs(abs(abs(abs(app(app(v(3), v(1)), app(app(v(2), v(1)), v(0)))))));

const strategies = ["normal-order", "call-by-name", "call-by-value", "applicative-order", "head-reduction"] as const;
type Strategy = (typeof strategies)[number];
type TestCase = [ast.Expression, Record<Strategy, ast.Expression>];
const strategyFuncs: Record<Strategy, (e: ast.Expression) => ast.Expression> = {
	"normal-order": reduce.normalOrder,
	"call-by-name": reduce.callByName,
	"call-by-value": reduce.callByValue,
	"applicative-order": reduce.applicativeOrder,
	"head-reduction": reduce.headReduction,
};

const cases: TestCase[] = [
	// stuck terms
	[
		v(0),
		{
			"normal-order": v(0),
			"call-by-name": v(0),
			"call-by-value": v(0),
			"applicative-order": v(0),
			"head-reduction": v(0),
		},
	],
	[
		abs(v(0)),
		{
			"normal-order": abs(v(0)),
			"call-by-name": abs(v(0)),
			"call-by-value": abs(v(0)),
			"applicative-order": abs(v(0)),
			"head-reduction": abs(v(0)),
		},
	],
	// SKI
	[
		app(I, K),
		{
			"normal-order": K,
			"call-by-name": K,
			"call-by-value": K,
			"applicative-order": K,
			"head-reduction": K,
		},
	],
	[
		app(app(S, K), K),
		{
			"normal-order": I,
			"call-by-name": reduce.betaStep(reduce.betaStep(S, K) as ast.Abstraction, K),
			"call-by-value": reduce.betaStep(reduce.betaStep(S, K) as ast.Abstraction, K),
			"applicative-order": I,
			"head-reduction": I,
		},
	],
	[
		app(SUCC, ZERO),
		{
			"normal-order": ONE,
			"call-by-name": reduce.betaStep(SUCC, ZERO),
			"call-by-value": reduce.betaStep(SUCC, ZERO),
			"applicative-order": ONE,
			"head-reduction": reduce.betaStep(SUCC, ZERO),
		},
	],
	[
		app(ADD, ONE),
		{
			"normal-order": SUCC,
			"call-by-name": reduce.betaStep(ADD, ONE),
			"call-by-value": reduce.betaStep(ADD, ONE),
			"applicative-order": SUCC,
			"head-reduction": SUCC,
		},
	],
	[
		app(NOT, TRUE),
		{
			"normal-order": FALSE,
			"call-by-name": reduce.betaStep(NOT, TRUE),
			"call-by-value": reduce.betaStep(NOT, TRUE),
			"applicative-order": FALSE,
			"head-reduction": FALSE,
		},
	],
	[
		app(app(AND, TRUE), TRUE),
		{
			"normal-order": TRUE,
			"call-by-name": reduce.betaStep(reduce.betaStep(AND, TRUE) as ast.Abstraction, TRUE),
			"call-by-value": reduce.betaStep(reduce.betaStep(AND, TRUE) as ast.Abstraction, TRUE),
			"applicative-order": TRUE,
			"head-reduction": TRUE,
		},
	],
	[
		app(app(OR, TRUE), FALSE),
		{
			"normal-order": TRUE,
			"call-by-name": reduce.betaStep(reduce.betaStep(OR, TRUE) as ast.Abstraction, FALSE),
			"call-by-value": reduce.betaStep(reduce.betaStep(OR, TRUE) as ast.Abstraction, FALSE),
			"applicative-order": TRUE,
			"head-reduction": TRUE,
		},
	],
];

suite("Reduction strategies", () => {
	for (const strategy of strategies) {
		const strategyFunc = strategyFuncs[strategy];
		test(strategy, (t) => {
			for (const [input, expecteds] of cases) {
				const expected = expecteds[strategy];
				t.test(`${ast.toString(input)} -> ${ast.toString(expected)}`, () => {
					const actual = strategyFunc(input);
					deepStrictEqual(actual, expected, ast.toString(actual));
				});
			}
		});
	}
});
