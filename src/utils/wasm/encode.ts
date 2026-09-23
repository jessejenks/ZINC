import { ByteWriter } from "./bytes";
import {
	AbsHeapType,
	BlockKind,
	BlockType,
	CompKind,
	CompType,
	Elem,
	Export,
	FieldType,
	Func,
	Global,
	HeapKind,
	HeapType,
	Import,
	Instr,
	Label,
	Module,
	NumType,
	Op,
	PackedType,
	RecType,
	RefType,
	StorageKind,
	StorageType,
	SubType,
	Table,
	ValKind,
	ValType,
} from "./wasm";

export const enum SectionId {
	Custom = 0,
	Type = 1,
	Import = 2,
	Function = 3,
	Table = 4,
	Memory = 5,
	Global = 6,
	Export = 7,
	Start = 8,
	Element = 9,
	Code = 10,
	Data = 11,
	DataCount = 12,
	Tag = 13,
}

export function encode(m: Module): Uint8Array<ArrayBuffer> {
	const w = new ByteWriter();
	w.bytes([0x00, 0x61, 0x73, 0x6d]);
	w.bytes([0x01, 0x00, 0x00, 0x00]);
	section(w, SectionId.Type, m.types, recType);
	section(w, SectionId.Import, m.imports, import_);
	section(w, SectionId.Function, m.funcs, (w, f) => w.u32(f.type));
	section(w, SectionId.Table, m.tables, table);
	section(w, SectionId.Global, m.globals, global);
	section(w, SectionId.Export, m.exports, export_);
	section(w, SectionId.Element, m.elems, elem);
	section(w, SectionId.Code, m.funcs, code);
	return w.finish();
}

function section<T>(w: ByteWriter, id: SectionId, entries: readonly T[], entry: (w: ByteWriter, e: T) => void) {
	if (entries.length === 0) {
		return;
	}
	const body = new ByteWriter();
	body.u32(entries.length);
	for (let i = 0; i < entries.length; i++) {
		entry(body, entries[i]);
	}
	w.u8(id);
	w.sized(body);
}

function recType(w: ByteWriter, rec: RecType) {
	if (rec.types.length === 1) {
		subType(w, rec.types[0]);
		return;
	}
	w.u8(0x4e);
	w.u32(rec.types.length);
	for (let i = 0; i < rec.types.length; i++) {
		subType(w, rec.types[i]);
	}
}

function subType(w: ByteWriter, sub: SubType) {
	if (sub.final && sub.supers.length === 0) {
		compType(w, sub.type);
		return;
	}
	w.u8(sub.final ? 0x4f : 0x50);
	w.u32(sub.supers.length);
	for (let i = 0; i < sub.supers.length; i++) {
		w.u32(sub.supers[i]);
	}
	compType(w, sub.type);
}

function compType(w: ByteWriter, comp: CompType) {
	switch (comp.kind) {
		case CompKind.Func:
			w.u8(0x60);
			w.u32(comp.params.length);
			for (let i = 0; i < comp.params.length; i++) {
				valType(w, comp.params[i]);
			}
			w.u32(comp.results.length);
			for (let i = 0; i < comp.results.length; i++) {
				valType(w, comp.results[i]);
			}
			break;
		case CompKind.Struct:
			w.u8(0x5f);
			w.u32(comp.fields.length);
			for (let i = 0; i < comp.fields.length; i++) {
				fieldType(w, comp.fields[i]);
			}
			break;
		case CompKind.Array:
			w.u8(0x5e);
			fieldType(w, comp.element);
			break;
	}
}

function fieldType(w: ByteWriter, f: FieldType) {
	storageType(w, f.type);
	w.u8(f.mutable ? 0x01 : 0x00);
}

function storageType(w: ByteWriter, t: StorageType) {
	switch (t.kind) {
		case StorageKind.Val:
			valType(w, t.valType);
			break;
		case StorageKind.Packed:
			switch (t.packedType) {
				case PackedType.I16:
					w.u8(0x77);
					break;
				case PackedType.I8:
					w.u8(0x78);
					break;
			}
	}
}

function valType(w: ByteWriter, t: ValType) {
	switch (t.kind) {
		case ValKind.Num:
			switch (t.numType) {
				case NumType.F64:
					w.u8(0x7c);
					break;
				case NumType.F32:
					w.u8(0x7d);
					break;
				case NumType.I64:
					w.u8(0x7e);
					break;
				case NumType.I32:
					w.u8(0x7f);
					break;
			}
			break;
		case ValKind.Vec:
			w.u8(0x7b);
			break;
		case ValKind.Ref:
			refType(w, t.refType);
			break;
	}
}

function refType(w: ByteWriter, t: RefType) {
	w.u8(t.nullable ? 0x63 : 0x64);
	heapType(w, t.heap);
}

function heapType(w: ByteWriter, h: HeapType) {
	switch (h.kind) {
		case HeapKind.Abs:
			absHeapType(w, h.absHeapType);
			break;
		case HeapKind.Idx:
			w.s33(h.idx);
			break;
	}
}

function absHeapType(w: ByteWriter, h: AbsHeapType) {
	switch (h) {
		case AbsHeapType.Exn:
			w.u8(0x69);
			break;
		case AbsHeapType.Array:
			w.u8(0x6a);
			break;
		case AbsHeapType.Struct:
			w.u8(0x6b);
			break;
		case AbsHeapType.I31:
			w.u8(0x6c);
			break;
		case AbsHeapType.Eq:
			w.u8(0x6d);
			break;
		case AbsHeapType.Any:
			w.u8(0x6e);
			break;
		case AbsHeapType.Extern:
			w.u8(0x6f);
			break;
		case AbsHeapType.Func:
			w.u8(0x70);
			break;
		case AbsHeapType.None:
			w.u8(0x71);
			break;
		case AbsHeapType.NoExtern:
			w.u8(0x72);
			break;
		case AbsHeapType.NoFunc:
			w.u8(0x73);
			break;
		case AbsHeapType.NoExn:
			w.u8(0x74);
			break;
	}
}

function blockType(w: ByteWriter, b: BlockType) {
	switch (b.kind) {
		case BlockKind.Empty:
			w.u8(0x40);
			break;
		case BlockKind.Val:
			valType(w, b.valType);
			break;
		case BlockKind.Idx:
			w.s33(b.idx);
			break;
	}
}

function import_(w: ByteWriter, i: Import) {
	w.string(i.module);
	w.string(i.name);
	w.u8(0x00);
	w.u32(i.desc.type);
}

function table(w: ByteWriter, t: Table) {
	refType(w, t.element);
	if (t.max === undefined) {
		w.u8(0x00);
		w.u32(t.min);
	} else {
		w.u8(0x01);
		w.u32(t.min);
		w.u32(t.max);
	}
}

function global(w: ByteWriter, g: Global) {
	valType(w, g.type);
	w.u8(g.mutable ? 0x01 : 0x00);
	expr(w, g.init, []);
}

function export_(w: ByteWriter, e: Export) {
	w.string(e.name);
	switch (e.desc.kind) {
		case "func":
			w.u8(0x00);
			break;
		case "global":
			w.u8(0x03);
			break;
	}
	w.u32(e.desc.index);
}

function elem(w: ByteWriter, e: Elem) {
	if ("declarative" in e) {
		w.u8(0x03);
	} else {
		w.u8(0x02);
		w.u32(e.table);
		expr(w, [{ op: Op.I32Const, value: e.offset }], []);
	}
	w.u8(0x00);
	w.u32(e.funcs.length);
	for (const f of e.funcs) {
		w.u32(f);
	}
}

function code(w: ByteWriter, f: Func) {
	const body = new ByteWriter();
	const runs: [number, ValType][] = [];
	for (let i = 0; i < f.locals.length; i++) {
		const last = runs[runs.length - 1];
		if (last !== undefined && sameValType(last[1], f.locals[i])) {
			last[0]++;
		} else {
			runs.push([1, f.locals[i]]);
		}
	}
	body.u32(runs.length);
	for (let i = 0; i < runs.length; i++) {
		const [count, tp] = runs[i];
		body.u32(count);
		valType(body, tp);
	}
	expr(body, f.body, []);
	w.sized(body);
}

function sameValType(a: ValType, b: ValType): boolean {
	switch (a.kind) {
		case ValKind.Num:
			return a.kind === b.kind && a.numType === b.numType;
		case ValKind.Vec:
			return a.kind === b.kind;
		case ValKind.Ref:
			return a.kind === b.kind && sameRefType(a.refType, b.refType);
	}
}

function sameRefType(a: RefType, b: RefType): boolean {
	if (a.nullable !== b.nullable) {
		return false;
	}
	switch (a.heap.kind) {
		case HeapKind.Abs:
			return a.heap.kind === b.heap.kind && a.heap.absHeapType === b.heap.absHeapType;
		case HeapKind.Idx:
			return a.heap.kind === b.heap.kind && a.heap.idx === b.heap.idx;
	}
}

function expr(w: ByteWriter, body: readonly Instr[], labels: Label[]) {
	for (let i = 0; i < body.length; i++) {
		instruction(w, body[i], labels);
	}
	w.u8(0x0b);
}

function labelDepth(labels: Label[], label: Label): number {
	for (let i = labels.length - 1; i >= 0; i--) {
		if (labels[i] === label) {
			return labels.length - 1 - i;
		}
	}
	throw new Error(`Branch to label ${label.name ?? "<anonymous>"} which is not in scope`);
}

function instruction(w: ByteWriter, instr: Instr, labels: Label[]) {
	switch (instr.op) {
		case Op.Unreachable:
			w.u8(0x00);
			break;
		case Op.Nop:
			w.u8(0x01);
			break;
		case Op.Block:
		case Op.Loop:
			w.u8(instr.op === Op.Block ? 0x02 : 0x03);
			blockType(w, instr.blockType);
			labels.push(instr.label);
			expr(w, instr.body, labels);
			labels.pop();
			break;
		case Op.If:
			w.u8(0x04);
			blockType(w, instr.blockType);
			labels.push(instr.label);
			for (let i = 0; i < instr.then.length; i++) {
				instruction(w, instr.then[i], labels);
			}
			if (instr.else.length > 0) {
				w.u8(0x05);
				for (let i = 0; i < instr.else.length; i++) {
					instruction(w, instr.else[i], labels);
				}
			}
			w.u8(0x0b);
			labels.pop();
			break;
		case Op.Br:
			w.u8(0x0c);
			w.u32(labelDepth(labels, instr.label));
			break;
		case Op.BrIf:
			w.u8(0x0d);
			w.u32(labelDepth(labels, instr.label));
			break;
		case Op.Return:
			w.u8(0x0f);
			break;
		case Op.Call:
			w.u8(0x10);
			w.u32(instr.func);
			break;
		case Op.CallIndirect:
			w.u8(0x11);
			w.u32(instr.type);
			w.u32(instr.table);
			break;
		case Op.ReturnCall:
			w.u8(0x12);
			w.u32(instr.func);
			break;
		case Op.ReturnCallIndirect:
			w.u8(0x13);
			w.u32(instr.type);
			w.u32(instr.table);
			break;
		case Op.CallRef:
			w.u8(0x14);
			w.u32(instr.type);
			break;
		case Op.ReturnCallRef:
			w.u8(0x15);
			w.u32(instr.type);
			break;
		case Op.Drop:
			w.u8(0x1a);
			break;
		case Op.Select:
			w.u8(0x1b);
			break;
		case Op.LocalGet:
			w.u8(0x20);
			w.u32(instr.index);
			break;
		case Op.LocalSet:
			w.u8(0x21);
			w.u32(instr.index);
			break;
		case Op.LocalTee:
			w.u8(0x22);
			w.u32(instr.index);
			break;
		case Op.GlobalGet:
			w.u8(0x23);
			w.u32(instr.index);
			break;
		case Op.GlobalSet:
			w.u8(0x24);
			w.u32(instr.index);
			break;
		case Op.I32Const:
			w.u8(0x41);
			w.i32(instr.value);
			break;
		case Op.I64Const:
			w.u8(0x42);
			w.i64(instr.value);
			break;
		case Op.I32EQZ:
			w.u8(0x45);
			break;
		case Op.I32EQ:
			w.u8(0x46);
			break;
		case Op.I32NE:
			w.u8(0x47);
			break;
		case Op.I32LT_S:
			w.u8(0x48);
			break;
		case Op.I32LT_U:
			w.u8(0x49);
			break;
		case Op.I32GT_S:
			w.u8(0x4a);
			break;
		case Op.I32GT_U:
			w.u8(0x4b);
			break;
		case Op.I32LE_S:
			w.u8(0x4c);
			break;
		case Op.I32LE_U:
			w.u8(0x4d);
			break;
		case Op.I32GE_S:
			w.u8(0x4e);
			break;
		case Op.I32GE_U:
			w.u8(0x4f);
			break;
		case Op.I64EQZ:
			w.u8(0x50);
			break;
		case Op.I64EQ:
			w.u8(0x51);
			break;
		case Op.I64NE:
			w.u8(0x52);
			break;
		case Op.I64LT_S:
			w.u8(0x53);
			break;
		case Op.I64LT_U:
			w.u8(0x54);
			break;
		case Op.I64GT_S:
			w.u8(0x55);
			break;
		case Op.I64GT_U:
			w.u8(0x56);
			break;
		case Op.I64LE_S:
			w.u8(0x57);
			break;
		case Op.I64LE_U:
			w.u8(0x58);
			break;
		case Op.I64GE_S:
			w.u8(0x59);
			break;
		case Op.I64GE_U:
			w.u8(0x5a);
			break;
		case Op.I32ADD:
			w.u8(0x6a);
			break;
		case Op.I32SUB:
			w.u8(0x6b);
			break;
		case Op.I32MUL:
			w.u8(0x6c);
			break;
		case Op.I64ADD:
			w.u8(0x7c);
			break;
		case Op.I64SUB:
			w.u8(0x7d);
			break;
		case Op.I64MUL:
			w.u8(0x7e);
			break;
		case Op.RefNull:
			w.u8(0xd0);
			heapType(w, instr.heap);
			break;
		case Op.RefIsNull:
			w.u8(0xd1);
			break;
		case Op.RefFunc:
			w.u8(0xd2);
			w.u32(instr.func);
			break;
		case Op.RefEq:
			w.u8(0xd3);
			break;
		case Op.StructNew:
			gc(w, 0, instr.type);
			break;
		case Op.StructNewDefault:
			gc(w, 1, instr.type);
			break;
		case Op.StructGet:
			gc(w, 2, instr.type, instr.field);
			break;
		case Op.StructGetS:
			gc(w, 3, instr.type, instr.field);
			break;
		case Op.StructGetU:
			gc(w, 4, instr.type, instr.field);
			break;
		case Op.StructSet:
			gc(w, 5, instr.type, instr.field);
			break;
		case Op.ArrayNew:
			gc(w, 6, instr.type);
			break;
		case Op.ArrayNewDefault:
			gc(w, 7, instr.type);
			break;
		case Op.ArrayNewFixed:
			gc(w, 8, instr.type, instr.length);
			break;
		case Op.ArrayGet:
			gc(w, 11, instr.type);
			break;
		case Op.ArrayGetS:
			gc(w, 12, instr.type);
			break;
		case Op.ArrayGetU:
			gc(w, 13, instr.type);
			break;
		case Op.ArraySet:
			gc(w, 14, instr.type);
			break;
		case Op.ArrayLen:
			gc(w, 15);
			break;
		case Op.RefTest:
			gc(w, instr.type.nullable ? 21 : 20);
			heapType(w, instr.type.heap);
			break;
		case Op.RefCast:
			gc(w, instr.type.nullable ? 23 : 22);
			heapType(w, instr.type.heap);
			break;
		case Op.RefI31:
			gc(w, 28);
			break;
		case Op.I31GetS:
			gc(w, 29);
			break;
		case Op.I31GetU:
			gc(w, 30);
			break;
	}
}

function gc(w: ByteWriter, sub: number, ...immediates: number[]) {
	w.u8(0xfb);
	w.u32(sub);
	for (let i = 0; i < immediates.length; i++) {
		w.u32(immediates[i]);
	}
}
