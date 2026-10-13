import { ByteReader } from "./bytes";

function formatHex(n: number | bigint): string {
	return n.toString(16).padStart(2, "0");
}

export class WASMDecoder {
	protected index: number;

	constructor(protected bytes: Uint8Array<ArrayBuffer>) {
		this.index = 0;
	}

	protected printRange(length: number | bigint, msg: string) {
		const row = new Array<string>(Number(length));
		for (let i = 0; i < length; i++) {
			row[i] = formatHex(this.bytes[this.index + i]);
		}
		console.log(this.index.toString().padStart(8, "0"), ":", row.join(" ").padEnd(40), ";", msg);
	}

	protected printByte(msg: string) {
		console.log(this.index.toString().padStart(8, "0"), ":", formatHex(this.bytes[this.index]).padEnd(40), ";", msg);
	}

	decode() {
		this.printRange(4, "WASM_BINARY_MAGIC");
		this.index += 4;
		this.printRange(4, "WASM_BINARY_VERSION");
		this.index += 4;
		while (this.index < this.bytes.length) {
			switch (this.bytes[this.index]) {
				case 1:
					this.decodeTypeSection();
					break;
				case 2:
					this.decodeImportSection();
					break;
				case 3:
					this.decodeFunctionSection();
					break;
				case 6:
					this.decodeGlobalSection();
					break;
				case 7:
					this.decodeExportSection();
					break;
				case 9:
					this.decodeElementSection();
					break;
				case 10:
					this.decodeCodeSection();
					break;
				default:
					throw new Error(`Section id ${this.bytes[this.index]} not implemented`);
			}
		}
	}

	protected decodeTypeSection() {
		this.sectionPreamble("Type", 1);
		this.decodeList("num types", (i) => {
			console.log(`;; type ${i + 1}`);
			this.decodeTypeEntry();
		});
	}

	protected decodeTypeEntry() {
		if (this.bytes[this.index] === 0x4e) {
			this.printByte("rec type*");
			this.index++;
			this.decodeList("num subtypes", () => {
				this.decodeSubtype();
			});
			return;
		}
		this.decodeSubtype();
	}

	protected decodeSubtype() {
		switch (this.bytes[this.index]) {
			case 0x4f:
				this.printByte("sub final x* ct");
				this.index++;
				this.decodeList("num type indices", () => this.decodeu32("type index"));
				break;
			case 0x50:
				this.printByte("sub x* ct");
				this.index++;
				this.decodeList("num type indices", () => this.decodeu32("type index"));
				break;
			default:
				break;
		}
		this.decodeComptype();
	}

	protected decodeComptype() {
		switch (this.bytes[this.index]) {
			case 0x5e:
				this.printByte("array");
				this.index++;
				console.log("TODO array");
				break;
			case 0x5f:
				this.printByte("struct");
				this.index++;
				this.decodeList("num field types", (i) => {
					console.log(`;;; field ${i + 1}`);
					this.decodeFieldType();
				});
				break;
			case 0x60:
				this.printByte("func");
				this.index++;
				this.decodeResultType("num parameters");
				this.decodeResultType("num return values");
				break;
			default:
				throw new Error(`Unknown compound type ${formatHex(this.bytes[this.index])}`);
		}
	}

	protected decodeFieldType() {
		switch (this.bytes[this.index]) {
			case 0x77:
				this.printByte("pack type i16");
				this.index++;
				break;
			case 0x78:
				this.printByte("pack type i8");
				this.index++;
				break;
			default:
				this.decodeValType();
				break;
		}
		this.decodeMut();
	}

	protected decodeMut() {
		switch (this.bytes[this.index]) {
			case 0x00:
				this.printByte("immutable");
				this.index++;
				break;
			case 0x01:
				this.printByte("mutable");
				this.index++;
				break;
		}
	}

	protected decodeResultType(msg: string) {
		this.decodeList(msg, () => this.decodeValType());
	}

	protected decodeValType() {
		switch (this.bytes[this.index]) {
			case 0x7c:
				this.printByte("f64");
				this.index++;
				break;
			case 0x7d:
				this.printByte("f32");
				this.index++;
				break;
			case 0x7e:
				this.printByte("i64");
				this.index++;
				break;
			case 0x7f:
				this.printByte("i32");
				this.index++;
				break;
			case 0x7b:
				this.printByte("vec128");
				this.index++;
				break;
			case 0x63:
				this.printByte("ref null");
				this.index++;
				this.decodeHeapType();
				break;
			case 0x64:
				this.printByte("ref");
				this.index++;
				this.decodeHeapType();
				break;
			default:
				this.decodeHeapType();
				break;
		}
	}

	protected decodeHeapType() {
		switch (this.bytes[this.index]) {
			case 0x69:
				this.printByte("exn");
				this.index++;
				break;
			case 0x6a:
				this.printByte("array");
				this.index++;
				break;
			case 0x6b:
				this.printByte("struct");
				this.index++;
				break;
			case 0x6c:
				this.printByte("i31");
				this.index++;
				break;
			case 0x6d:
				this.printByte("eq");
				this.index++;
				break;
			case 0x6e:
				this.printByte("any");
				this.index++;
				break;
			case 0x6f:
				this.printByte("extern");
				this.index++;
				break;
			case 0x70:
				this.printByte("func");
				this.index++;
				break;
			case 0x71:
				this.printByte("none");
				this.index++;
				break;
			case 0x72:
				this.printByte("noextern");
				this.index++;
				break;
			case 0x73:
				this.printByte("nofunc");
				this.index++;
				break;
			case 0x74:
				this.printByte("noexn");
				this.index++;
				break;
			default: {
				const [offset, value] = ByteReader.s33(this.bytes, this.index);
				this.printByte(`typeidx ${value.toString()}`);
				this.index += offset;
				break;
			}
		}
	}

	protected decodeImportSection() {
		this.sectionPreamble("Import", 2);
		this.decodeList("num imports", () => this.decodeImport());
	}

	protected decodeImport() {
		this.decodeName("import module name");
		this.decodeName("import name");
		this.decodeExternType();
	}

	protected decodeExternType() {
		switch (this.bytes[this.index]) {
			case 0x00:
				this.printByte("extern type func");
				this.index++;
				this.decodeu32("typeidx");
				break;
			default:
				throw new Error(`Extern type not implemented ${formatHex(this.bytes[this.index])}`);
		}
	}

	protected decodeFunctionSection() {
		this.sectionPreamble("Function", 3);
		this.decodeList("num functions", () => this.decodeu32("type index"));
	}

	protected decodeGlobalSection() {
		this.sectionPreamble("Global", 6);
		this.decodeList("num globals", () => this.decodeGlobal());
	}

	protected decodeGlobal() {
		this.decodeValType();
		this.decodeMut();
		this.decodeExpression();
	}

	protected decodeExportSection() {
		this.sectionPreamble("Export", 7);
		this.decodeList("num exports", () => this.decodeExport());
	}

	protected decodeExport() {
		this.decodeName("export name");
		this.decodeExternId();
	}

	protected decodeName(msg: string) {
		const [nameLengthOffset, nameLength] = ByteReader.u32(this.bytes, this.index);
		this.printRange(nameLengthOffset, "string length");
		this.index += nameLengthOffset;
		const nameLengthNum = Number(nameLength);
		const chars = new Uint8Array(nameLengthNum);
		for (let i = 0; i < nameLengthNum; i++) {
			chars[i] = this.bytes[this.index + i];
		}
		const name = new TextDecoder().decode(chars);
		this.printRange(nameLengthNum, `"${name}" ${msg}`);
		this.index += nameLengthNum;
	}

	protected decodeExternId() {
		this.printByte("export kind");
		switch (this.bytes[this.index]) {
			case 0x00:
				this.index++;
				this.printByte("func index");
				this.index++;
				break;
			case 0x01:
				this.index++;
				this.printByte("table index");
				this.index++;
				break;
			case 0x02:
				this.index++;
				this.printByte("memory index");
				this.index++;
				break;
			case 0x03:
				this.index++;
				this.printByte("global index");
				this.index++;
				break;
			case 0x04:
				this.index++;
				this.printByte("tag index");
				this.index++;
				break;
		}
	}

	protected decodeElementSection() {
		this.sectionPreamble("Element", 9);
		this.decodeList("num elements", () => this.decodeElement());
	}

	protected decodeElement() {
		switch (this.bytes[this.index]) {
			case 0x02:
				this.printByte("elem active");
				this.index++;
				const [offset, value] = ByteReader.u32(this.bytes, this.index);
				this.printRange(offset, `elem typeidx ${value.toString()}`);
				this.index += offset;
				this.decodeExpression();
				this.printByte("elemkind (ref func)");
				this.index++;
				this.decodeList("functions", () => this.decodeu32("funcidx"));
				break;
			case 0x03:
				this.printByte("elem declare");
				this.index++;
				this.printByte("elemkind (ref func)");
				this.index++;
				this.decodeList("functions", () => this.decodeu32("funcidx"));
				break;
		}
	}

	protected decodeCodeSection() {
		this.sectionPreamble("Code", 10);
		this.decodeList("num functions", (i) => {
			console.log(`; function body ${i}`);
			this.decodeCode();
		});
	}

	protected decodeCode() {
		const [sizeOffset] = ByteReader.u32(this.bytes, this.index);
		this.printRange(sizeOffset, "func body size");
		this.index += sizeOffset;
		this.decodeFunc();
	}

	protected decodeFunc() {
		this.decodeList("num locals", (i) => {
			console.log(`begin local ${i}`);
			this.decodeLocals();
			console.log(`end   local ${i}`);
		});
		this.decodeExpression();
	}

	protected decodeLocals() {
		const [sizeOffset] = ByteReader.u32(this.bytes, this.index);
		this.printRange(sizeOffset, "local count");
		this.index += sizeOffset;
		this.decodeValType();
	}

	protected sectionPreamble(name: string, id: number) {
		console.log(`; section "${name}" (${id})`);
		this.printByte("section id");
		this.index++;
		const [sizeOffset] = ByteReader.u32(this.bytes, this.index);
		this.printRange(sizeOffset, "section size");
		this.index += sizeOffset;
	}

	protected decodeExpression() {
		while (this.bytes[this.index] !== 0x0b) {
			this.decodeInstruction();
		}
		this.printByte("end of expression");
		this.index++;
	}

	protected decodeBlockType() {
		const b = this.bytes[this.index];
		if (b === 0x40) {
			this.printByte("empty");
			this.index++;
			return;
		}
		if (0x40 < b && b < 0x80) {
			this.decodeValType();
			return;
		}
		const [offset, value] = ByteReader.s33(this.bytes, this.index);
		this.printByte(`typeidx ${value.toString()}`);
		this.index += offset;
	}

	protected decodeInstrWithArgs(
		msg: string,
		numArgs: number,
		decoder: (bytes: Uint8Array<ArrayBuffer>, start: number) => [number, bigint],
	) {
		const values = new Array<string>(numArgs);
		let offset: number, value: bigint;
		let curr = this.index + 1;
		for (let i = 0; i < numArgs; i++) {
			[offset, value] = decoder(this.bytes, curr);
			values[i] = value.toString();
			curr += offset;
		}
		this.printRange(curr - this.index, `${msg} ${values.join(" ")}`);
		this.index = curr;
	}

	protected decodeInstruction() {
		switch (this.bytes[this.index]) {
			case 0x00:
				this.printByte("unreachable");
				this.index++;
				break;
			case 0x01:
				this.printByte("nop");
				this.index++;
				break;
			case 0x02:
			case 0x03:
				this.printByte(this.bytes[this.index] === 0x02 ? "block" : "loop");
				this.index++;
				this.decodeBlockType();
				this.decodeExpression();
				break;
			case 0x04: {
				this.printByte("if");
				this.index++;
				this.decodeBlockType();
				let b = this.bytes[this.index];
				while (b != 0x05 && b != 0x0b) {
					this.decodeInstruction();
					b = this.bytes[this.index];
				}
				if (b === 0x05) {
					this.printByte("else");
					this.index++;
					this.decodeExpression();
				} else {
					this.printByte("endif");
					this.index++;
				}
				break;
			}
			case 0x0c:
				this.printByte("br");
				this.index++;
				this.decodeu32("label");
				break;
			case 0x0d:
				this.printByte("br if");
				this.index++;
				this.decodeu32("label");
				break;
			case 0x0f:
				this.printByte("return");
				this.index++;
				break;
			case 0x10:
				this.printByte("call");
				this.index++;
				this.decodeu32("funcidx");
				break;
			case 0x11:
				this.printByte("call indirect");
				this.index++;
				this.decodeu32("typeidx");
				this.decodeu32("tableidx");
				break;
			case 0x12:
				this.printByte("return call");
				this.index++;
				this.decodeu32("funcidx");
				break;
			case 0x13:
				this.printByte("return call indirect");
				this.index++;
				this.decodeu32("typeidx");
				this.decodeu32("tableidx");
				break;
			case 0x14:
				this.printByte("call ref");
				this.index++;
				this.decodeu32("typeidx");
				break;
			case 0x15:
				this.printByte("return call ref");
				this.index++;
				this.decodeu32("typeidx");
				break;
			case 0x20:
				this.decodeInstrWithArgs("local.get", 1, ByteReader.u32);
				break;
			case 0x21:
				this.decodeInstrWithArgs("local.set", 1, ByteReader.u32);
				break;
			case 0x22:
				this.decodeInstrWithArgs("local.tee", 1, ByteReader.u32);
				break;
			case 0x23:
				this.printByte("global.get");
				this.index++;
				this.decodeu32("globalidx");
				break;
			case 0x24:
				this.printByte("global.set");
				this.index++;
				this.decodeu32("globalidx");
				break;
			case 0x41:
				this.decodeInstrWithArgs("i32.const", 1, ByteReader.i32);
				break;
			case 0x42:
				this.decodeInstrWithArgs("i64.const", 1, ByteReader.i64);
				break;
			case 0x45:
				this.printByte("i32.eqz");
				this.index++;
				break;
			case 0x46:
				this.printByte("i32.eq");
				this.index++;
				break;
			case 0x47:
				this.printByte("i32.ne");
				this.index++;
				break;
			case 0x48:
				this.printByte("i32.lt_s");
				this.index++;
				break;
			case 0x49:
				this.printByte("i32.lt_u");
				this.index++;
				break;
			case 0x4a:
				this.printByte("i32.gt_s");
				this.index++;
				break;
			case 0x4b:
				this.printByte("i32.gt_u");
				this.index++;
				break;
			case 0x4c:
				this.printByte("i32.le_s");
				this.index++;
				break;
			case 0x4d:
				this.printByte("i32.le_u");
				this.index++;
				break;
			case 0x4e:
				this.printByte("i32.ge_s");
				this.index++;
				break;
			case 0x4f:
				this.printByte("i32.ge_u");
				this.index++;
				break;
			case 0x6a:
				this.printByte("i32.add");
				this.index++;
				break;
			case 0x6b:
				this.printByte("i32.sub");
				this.index++;
				break;
			case 0x6c:
				this.printByte("i32.mul");
				this.index++;
				break;
			case 0x6d:
				this.printByte("i32.div_s");
				this.index++;
				break;
			case 0x71:
				this.printByte("i32.and");
				this.index++;
				break;
			case 0x72:
				this.printByte("i32.or");
				this.index++;
				break;
			case 0x73:
				this.printByte("i32.xor");
				this.index++;
				break;
			case 0xd0:
				this.printByte("ref.null");
				this.index++;
				this.decodeHeapType();
				break;
			case 0xd1:
				this.printByte("ref.is_null");
				this.index++;
				break;
			case 0xd2:
				this.printByte("ref.func");
				this.index++;
				this.decodeu32("funcidx");
				break;
			case 0xfb: {
				this.printByte("gc");
				this.index++;
				const [offset, value] = ByteReader.u32(this.bytes, this.index);
				switch (value) {
					case 0n:
						this.printRange(offset, "struct.new");
						this.index += offset;
						this.decodeu32("typeidx");
						break;
					case 1n:
						this.printRange(offset, "struct.new_default");
						this.index += offset;
						this.decodeu32("typeidx");
						break;
					case 2n:
						this.printRange(offset, "struct.get");
						this.index += offset;
						this.decodeu32("typeidx");
						this.decodeu32("fieldidx");
						break;
					case 3n:
						this.printRange(offset, "struct.get_s");
						this.index += offset;
						this.decodeu32("typeidx");
						this.decodeu32("fieldidx");
						break;
					case 4n:
						this.printRange(offset, "struct.get_u");
						this.index += offset;
						this.decodeu32("typeidx");
						this.decodeu32("fieldidx");
						break;
					case 5n:
						this.printRange(offset, "struct.set");
						this.index += offset;
						this.decodeu32("typeidx");
						this.decodeu32("fieldidx");
						break;
					case 6n:
						this.printRange(offset, "array.new");
						this.index += offset;
						this.decodeu32("typeidx");
						break;
					case 7n:
						this.printRange(offset, "array.new_default");
						this.index += offset;
						this.decodeu32("typeidx");
						break;
					case 8n:
						this.printRange(offset, "array.new_fixed");
						this.index += offset;
						this.decodeu32("typeidx");
						this.decodeu32("length");
						break;
					case 11n:
						this.printRange(offset, "array.get");
						this.index += offset;
						this.decodeu32("typeidx");
						break;
					case 12n:
						this.printRange(offset, "array.get_s");
						this.index += offset;
						this.decodeu32("typeidx");
						break;
					case 13n:
						this.printRange(offset, "array.get_u");
						this.index += offset;
						this.decodeu32("typeidx");
						break;
					case 14n:
						this.printRange(offset, "array.set");
						this.index += offset;
						this.decodeu32("typeidx");
						break;
					case 15n:
						this.printRange(offset, "array.len");
						this.index += offset;
						break;
					case 20n:
						this.printRange(offset, "ref.test");
						this.index += offset;
						this.decodeHeapType();
						break;
					case 21n:
						this.printRange(offset, "ref.test nullable");
						this.index += offset;
						this.decodeHeapType();
						break;
					case 22n:
						this.printRange(offset, "ref.cast");
						this.index += offset;
						this.decodeHeapType();
						break;
					case 23n:
						this.printRange(offset, "ref.cast nullable");
						this.index += offset;
						this.decodeHeapType();
						break;
					case 28n:
						this.printRange(offset, "ref.i31");
						this.index += offset;
						break;
					case 29n:
						this.printRange(offset, "i31.get_s");
						this.index += offset;
						break;
					case 30n:
						this.printRange(offset, "i31.get_u");
						this.index += offset;
						break;
				}
				break;
			}
			case 0x0b: // end of expression
				return;
			default:
				this.printByte("UNIMPLEMENTED INSTRUCTION");
				this.index++;
		}
	}

	protected decodeList(msg: string, item: (i: number) => void) {
		const size = this.decodeu32(msg);
		for (let i = 0n; i < size; i++) {
			item(Number(i));
		}
	}

	protected decodeu32(msg: string): bigint {
		const [sizeOffset, size] = ByteReader.u32(this.bytes, this.index);
		this.printRange(sizeOffset, `${msg} (${size.toString()})`);
		this.index += sizeOffset;
		return size;
	}
}
