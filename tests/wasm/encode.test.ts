import { deepStrictEqual } from "node:assert";
import test from "node:test";
import { wasm, wasmEncoder } from "../../src";

test("empty module", () => {
	const bytes = wasmEncoder.encode(wasm.module());
	deepStrictEqual(
		bytes,
		new Uint8Array([
			0x00, // magic
			0x61,
			0x73,
			0x6d,
			0x01, // version
			0x00,
			0x00,
			0x00,
		]),
	);
});

test("simple module", () => {
	const m = wasm.module();
	const mainTypeIdx = wasm.addType(
		m,
		wasm.funcType([wasm.numAsVal(wasm.NumType.I32)], [wasm.numAsVal(wasm.NumType.I32)]),
	);
	wasm.addFunc(
		m,
		wasm.func(
			mainTypeIdx,
			[wasm.numAsVal(wasm.NumType.I32)],
			[{ op: wasm.Op.LocalGet, index: wasm.localIdx(0) }, { op: wasm.Op.I32Const, value: 1 }, { op: wasm.Op.I32ADD }],
		),
	);
	const bytes = wasmEncoder.encode(m);
	deepStrictEqual(
		bytes,
		new Uint8Array([
			0x00, // magic
			0x61,
			0x73,
			0x6d,
			0x01, // version
			0x00,
			0x00,
			0x00,
			1, // Type section
			6, // size
			1, // num types
			0x60, // func
			1, // num parameters
			0x7f, // i32
			1, // num return values
			0x7f, // i32
			3, // Function section
			2, // size
			1, // num functions
			0, // type index
			10, // Code section
			11, // size
			1, // num functions
			9, // function body size
			1, // num locals
			1, // local count
			0x7f, // i32
			0x20, // local.get 0
			0,
			0x41, // i32.const 1
			1,
			0x6a, // i32.add
			0x0b, // end of expression
		]),
	);

	new WebAssembly.Instance(new WebAssembly.Module(bytes));
});
