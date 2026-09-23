import { ast, elaborate, parser, reduce, surface, zinc, zincWasm } from "../../src/arith";
import * as wasmEncode from "../../src/utils/wasm/encode";

const input = `\
let f = λx.x in
let g = λf.λy.λt.f y t + 1 in
let h = λz.λs. z * 2 + - s in
f g h 3 4`;
// ((3 * 2) + (- 4)) + 1 = 3
console.log(input);
const parsed = new parser.Parser().parse(input);
console.log(surface.toString(parsed));
const expr = elaborate.surfaceToCore(parsed);
console.log(ast.toString(expr));

console.log("=== call by value derivation ===");
const derivation = reduce.callByValueDerive(expr);
console.log(reduce.derivationToString(derivation));
const reduced = derivation.after;
console.log(ast.toString(reduced));
console.log(surface.toString(elaborate.coreToSurface(reduced)));

console.log("=== ZINC compiled            ===");
const compiler = new zinc.Compiler();
compiler.compile(expr);
compiler.printCompilation();
const machine = new zinc.Machine();
machine.load(compiler.getInstructions());
while (machine.step()) {}
const finalExpr = machine.readback(compiler.getReadback());
console.log(surface.toString(elaborate.coreToSurface(finalExpr)));

console.log("=== ZINC WASM compiled       ===");
const wasmCompiler = new zincWasm.Compiler();
wasmCompiler.compile(expr);
const bytes = wasmEncode.encode(wasmCompiler.getModule());

const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes));
const resultWasm = (instance.exports.main as () => unknown)();
console.log(resultWasm);
