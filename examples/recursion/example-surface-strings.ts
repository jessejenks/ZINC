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
	"let rec f = λn. if n == 0 then 1 else n * f (n - 1) in f 3",
];
export default terms;
