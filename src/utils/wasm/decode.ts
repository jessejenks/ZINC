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
				this.printByte(`typeidx (as s33?) ${value.toString()}`);
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

	protected decodeInstruction() {
		switch (this.bytes[this.index]) {
			case 0x10: {
				const [offset, value] = ByteReader.u32(this.bytes, this.index + 1);
				this.printRange(1 + offset, `call typeidx ${value.toString()}`);
				this.index++;
				this.index += offset;
				break;
			}
			case 0x20: {
				const [offset, value] = ByteReader.u32(this.bytes, this.index + 1);
				this.printRange(1 + offset, `local.get ${value.toString()}`);
				this.index++;
				this.index += offset;
				break;
			}
			case 0x21: {
				const [offset, value] = ByteReader.u32(this.bytes, this.index + 1);
				this.printRange(1 + offset, `local.set ${value.toString()}`);
				this.index++;
				this.index += offset;
				break;
			}
			case 0x22: {
				const [offset, value] = ByteReader.u32(this.bytes, this.index + 1);
				this.printRange(1 + offset, `local.tee ${value.toString()}`);
				this.index++;
				this.index += offset;
				break;
			}
			case 0x41: {
				const [offset, value] = ByteReader.i32(this.bytes, this.index + 1);
				this.printRange(1 + offset, `i32.const ${value}`);
				this.index++;
				this.index += offset;
				break;
			}
			case 0x42: {
				const [offset, value] = ByteReader.i64(this.bytes, this.index + 1);
				this.printRange(1 + offset, `i64.const ${value.toString()}`);
				this.index++;
				this.index += offset;
				break;
			}
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
			case 0xd0:
				this.printByte("ref.null");
				this.index++;
				this.decodeHeapType();
				break;
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
