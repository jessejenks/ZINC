const terms: string[] = [
	"((λx.λy.y) (λu.λv.v)) (λa.λb.a)",
	"((λx.λy.x) (λu.λv.v)) (λa.λb.a)",
	"(λx.λy.x) ((λu.λv.v) (λa.λb.b))",
	"()",
	"1",
	"1 + 2",
	"1 + ()",
	"λx.x + 1",
	"(λx.x + 1) 2",
	"(λx.x) (λy.y + 1) 4",
];
export default terms;
