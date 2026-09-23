import { hexDump } from "../../src/utils/wasm/bytes";
import * as wasmDecode from "../../src/utils/wasm/decode";
import * as wasmEncode from "../../src/utils/wasm/encode";
import * as wasm from "../../src/utils/wasm/wasm";

const myModule = wasm.module();
// define type i32 -> void
const printTypeIdx = wasm.addType(myModule, wasm.funcType([wasm.numAsVal(wasm.NumType.I32)], []));

// define type (i32 x i32) -> i32
const mainTypeIdx = wasm.addType(
	myModule,
	wasm.funcType([wasm.numAsVal(wasm.NumType.I32), wasm.numAsVal(wasm.NumType.I32)], [wasm.numAsVal(wasm.NumType.I32)]),
);
// declare import of function with type i32 -> void
const printFuncIdx = wasm.addImport(myModule, wasm.importFunc("fmt", "println", printTypeIdx));
// define function (λx y.(x + y) + 1) with type (i32 x i32) -> i32
const funcidx = wasm.addFunc(
	myModule,
	wasm.func(
		mainTypeIdx,
		[wasm.numAsVal(wasm.NumType.I32)],
		[
			{ op: wasm.Op.LocalGet, index: wasm.localIdx(0) },
			{ op: wasm.Op.LocalGet, index: wasm.localIdx(1) },
			{ op: wasm.Op.I32ADD },
			{ op: wasm.Op.I32Const, value: 1 },
			{ op: wasm.Op.I32ADD },
			{ op: wasm.Op.LocalTee, index: wasm.localIdx(2) },
			{ op: wasm.Op.Call, func: printFuncIdx },
			{ op: wasm.Op.LocalGet, index: wasm.localIdx(2) },
		],
	),
);
// export as "main"
wasm.addFuncExport(myModule, "main", funcidx);

const bytes = wasmEncode.encode(myModule);

try {
	console.log("instantiating module...");
	const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
		fmt: { println: (x: number) => console.log("printing", x) },
	});
	const main = instance.exports.main as (x: number, y: number) => number;
	console.log("calling main...");
	console.log("main(2, 3) =", main(2, 3));
} catch (e) {
	console.error(e);
	hexDump(bytes);
}

console.log("=== Decoding WASM binary ===");
const wasmParser = new wasmDecode.WASMDecoder(bytes);
wasmParser.decode();
