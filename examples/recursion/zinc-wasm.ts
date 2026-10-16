import { ast, elaborate, parser, reduce, renderDerivation, surface, zinc, zincWasm } from "../../src/recursion";
import * as wasmEncode from "../../src/utils/wasm/encode";

const input = `\
let rec f = λn. if n == 0 then 1 else n * f (n - 1) in f 3
`;
console.log(input);
const parsed = new parser.Parser().parse(input);
console.log(surface.toString(parsed));
const expr = elaborate.surfaceToCore(parsed);
console.log(ast.toString(expr));

console.log("=== call by value derivation ===");
const derivation = reduce.callByValueDerive(expr);
console.log(renderDerivation.derivationToString(derivation));
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
