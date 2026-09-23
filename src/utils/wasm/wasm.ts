export type TypeIdx = number & { readonly __brand: "TypeIdx" };
export type FuncIdx = number & { readonly __brand: "FuncIdx" };
export type TableIdx = number & { readonly __brand: "TableIdx" };
export type MemIdx = number & { readonly __brand: "MemIdx" };
export type GlobalIdx = number & { readonly __brand: "GlobalIdx" };
export type TagIdx = number & { readonly __brand: "TagIdx" };
export type ElemIdx = number & { readonly __brand: "ElemIdx" };
export type DataIdx = number & { readonly __brand: "DataIdx" };
export type LocalIdx = number & { readonly __brand: "LocalIdx" };
export type FieldIdx = number & { readonly __brand: "FieldIdx" };

export const typeIdx = (n: number) => n as TypeIdx;
export const funcIdx = (n: number) => n as FuncIdx;
export const tableIdx = (n: number) => n as TableIdx;
export const localIdx = (n: number) => n as LocalIdx;
export const globalIdx = (n: number) => n as GlobalIdx;
export const fieldIdx = (n: number) => n as FieldIdx;

export class Label {
	constructor(readonly name?: string) {}
}

export const enum NumType {
	F64,
	F32,
	I64,
	I32,
}

export const enum AbsHeapType {
	Exn,
	Array,
	Struct,
	I31,
	Eq,
	Any,
	Extern,
	Func,
	None,
	NoExtern,
	NoFunc,
	NoExn,
}

export const enum HeapKind {
	Abs,
	Idx,
}

export type HeapType = { kind: HeapKind.Abs; absHeapType: AbsHeapType } | { kind: HeapKind.Idx; idx: TypeIdx };

export const absAsHeap = (absHeapType: AbsHeapType): HeapType => ({ kind: HeapKind.Abs, absHeapType });
export const typeAsHeap = (idx: TypeIdx): HeapType => ({ kind: HeapKind.Idx, idx });

export type RefType = { nullable: boolean; heap: HeapType };
export const ref = (heap: HeapType, nullable = false): RefType => ({ nullable, heap });
export const refNull = (heap: HeapType): RefType => ref(heap, true);

export const anyref = refNull({ kind: HeapKind.Abs, absHeapType: AbsHeapType.Any });
export const funcref = refNull({ kind: HeapKind.Abs, absHeapType: AbsHeapType.Func });
export const i31ref = ref({ kind: HeapKind.Abs, absHeapType: AbsHeapType.I31 });

export const enum ValKind {
	Num,
	Vec,
	Ref,
}

export type ValType =
	| { kind: ValKind.Num; numType: NumType }
	| { kind: ValKind.Vec } // there's only 1 vec type
	| { kind: ValKind.Ref; refType: RefType };

export const numAsVal = (numType: NumType): ValType => ({ kind: ValKind.Num, numType });
export const refAsVal = (refType: RefType): ValType => ({ kind: ValKind.Ref, refType });

export const enum PackedType {
	I16,
	I8,
}

export const enum StorageKind {
	Val,
	Packed,
}

export type StorageType =
	| { kind: StorageKind.Val; valType: ValType }
	| { kind: StorageKind.Packed; packedType: PackedType };

export const valAsStorage = (valType: ValType): StorageType => ({ kind: StorageKind.Val, valType });

export type FieldType = { type: StorageType; mutable: boolean };

export const field = (type: StorageType, mutable = false): FieldType => ({ type, mutable });

export const enum CompKind {
	Func,
	Struct,
	Array,
}
export type CompType =
	| { kind: CompKind.Func; params: ValType[]; results: ValType[] }
	| { kind: CompKind.Struct; fields: FieldType[] }
	| { kind: CompKind.Array; element: FieldType };

export type SubType = { final: boolean; supers: TypeIdx[]; type: CompType };
export type RecType = { types: SubType[] };
export type TypeDef = RecType;

export const funcType = (params: ValType[], results: ValType[]): SubType => ({
	final: true,
	supers: [],
	type: { kind: CompKind.Func, params, results },
});

export const structType = (fields: FieldType[]): SubType => ({
	final: true,
	supers: [],
	type: { kind: CompKind.Struct, fields },
});

export const arrayType = (element: FieldType): SubType => ({
	final: true,
	supers: [],
	type: { kind: CompKind.Array, element },
});

export const enum BlockKind {
	Empty,
	Val,
	Idx,
}
export type BlockType =
	| { kind: BlockKind.Empty }
	| { kind: BlockKind.Val; valType: ValType }
	| { kind: BlockKind.Idx; idx: TypeIdx };

export const enum Op {
	Unreachable,
	Nop,
	Drop,
	Select,

	Block,
	Loop,
	If,
	Br,
	BrIf,
	Return,
	Call,
	CallIndirect,
	ReturnCall,
	ReturnCallIndirect,
	CallRef,
	ReturnCallRef,

	LocalGet,
	LocalSet,
	LocalTee,
	GlobalGet,
	GlobalSet,

	RefNull,
	RefIsNull,
	RefFunc,
	RefEq,
	RefI31,
	I31GetS,
	I31GetU,
	RefTest,
	RefCast,

	StructNew,
	StructNewDefault,
	StructGet,
	StructGetS,
	StructGetU,
	StructSet,

	ArrayNew,
	ArrayNewDefault,
	ArrayNewFixed,
	ArrayGet,
	ArrayGetS,
	ArrayGetU,
	ArraySet,
	ArrayLen,

	I32Const,
	I64Const,

	I32EQZ,
	I32EQ,
	I32NE,
	I32LT_S,
	I32LT_U,
	I32GT_S,
	I32GT_U,
	I32LE_S,
	I32LE_U,
	I32GE_S,
	I32GE_U,
	I64EQZ,
	I64EQ,
	I64NE,
	I64LT_S,
	I64LT_U,
	I64GT_S,
	I64GT_U,
	I64LE_S,
	I64LE_U,
	I64GE_S,
	I64GE_U,

	I32ADD,
	I32SUB,
	I32MUL,
	I64ADD,
	I64SUB,
	I64MUL,
}

type SimpleOp =
	| Op.Unreachable
	| Op.Nop
	| Op.Drop
	| Op.Select
	| Op.Return
	| Op.RefIsNull
	| Op.RefEq
	| Op.RefI31
	| Op.I31GetS
	| Op.I31GetU
	| Op.ArrayLen
	| Op.I32EQZ
	| Op.I32EQ
	| Op.I32NE
	| Op.I32LT_S
	| Op.I32LT_U
	| Op.I32GT_S
	| Op.I32GT_U
	| Op.I32LE_S
	| Op.I32LE_U
	| Op.I32GE_S
	| Op.I32GE_U
	| Op.I64EQZ
	| Op.I64EQ
	| Op.I64NE
	| Op.I64LT_S
	| Op.I64LT_U
	| Op.I64GT_S
	| Op.I64GT_U
	| Op.I64LE_S
	| Op.I64LE_U
	| Op.I64GE_S
	| Op.I64GE_U
	| Op.I32ADD
	| Op.I32SUB
	| Op.I32MUL
	| Op.I64ADD
	| Op.I64SUB
	| Op.I64MUL;

export type Instr =
	| { op: SimpleOp }
	| { op: Op.Block; blockType: BlockType; label: Label; body: Instr[] }
	| { op: Op.Loop; blockType: BlockType; label: Label; body: Instr[] }
	| { op: Op.If; blockType: BlockType; label: Label; then: Instr[]; else: Instr[] }
	| { op: Op.Br; label: Label }
	| { op: Op.BrIf; label: Label }
	| { op: Op.Call; func: FuncIdx }
	| { op: Op.CallIndirect; type: TypeIdx; table: TableIdx }
	| { op: Op.ReturnCall; func: FuncIdx }
	| { op: Op.ReturnCallIndirect; type: TypeIdx; table: TableIdx }
	| { op: Op.CallRef; type: TypeIdx }
	| { op: Op.ReturnCallRef; type: TypeIdx }
	| { op: Op.LocalGet; index: LocalIdx }
	| { op: Op.LocalSet; index: LocalIdx }
	| { op: Op.LocalTee; index: LocalIdx }
	| { op: Op.GlobalGet; index: GlobalIdx }
	| { op: Op.GlobalSet; index: GlobalIdx }
	| { op: Op.RefNull; heap: HeapType }
	| { op: Op.RefFunc; func: FuncIdx }
	| { op: Op.RefTest; type: RefType }
	| { op: Op.RefCast; type: RefType }
	| { op: Op.StructNew; type: TypeIdx }
	| { op: Op.StructNewDefault; type: TypeIdx }
	| { op: Op.StructGet; type: TypeIdx; field: FieldIdx }
	| { op: Op.StructGetS; type: TypeIdx; field: FieldIdx }
	| { op: Op.StructGetU; type: TypeIdx; field: FieldIdx }
	| { op: Op.StructSet; type: TypeIdx; field: FieldIdx }
	| { op: Op.ArrayNew; type: TypeIdx }
	| { op: Op.ArrayNewDefault; type: TypeIdx }
	| { op: Op.ArrayNewFixed; type: TypeIdx; length: number }
	| { op: Op.ArrayGet; type: TypeIdx }
	| { op: Op.ArrayGetS; type: TypeIdx }
	| { op: Op.ArrayGetU; type: TypeIdx }
	| { op: Op.ArraySet; type: TypeIdx }
	| { op: Op.I32Const; value: number }
	| { op: Op.I64Const; value: bigint };

export type Func = { type: TypeIdx; locals: ValType[]; body: Instr[]; name?: string };
export type Import = { module: string; name: string; desc: { kind: "func"; type: TypeIdx } };
export type Table = { element: RefType; min: number; max?: number };
export type Global = { type: ValType; mutable: boolean; init: Instr[] };
export type Export = { name: string; desc: { kind: "func"; index: FuncIdx } | { kind: "global"; index: GlobalIdx } };
export type Elem = { table: TableIdx; offset: number; funcs: FuncIdx[] } | { declarative: true; funcs: FuncIdx[] };

export type Module = {
	types: TypeDef[];
	imports: Import[];
	funcs: Func[];
	tables: Table[];
	globals: Global[];
	exports: Export[];
	elems: Elem[];
};

export function module(): Module {
	return { types: [], imports: [], funcs: [], tables: [], globals: [], exports: [], elems: [] };
}

export function importFunc(module: string, name: string, typeidx: TypeIdx): Import {
	return { module, name, desc: { kind: "func", type: typeidx } };
}

export function func(typeidx: TypeIdx, locals: ValType[], body: Instr[], name?: string): Func {
	return { type: typeidx, locals, body, name };
}

export function addType(m: Module, type: SubType): TypeIdx {
	return addRecGroup(m, [type]);
}

export function addRecGroup(m: Module, types: SubType[]): TypeIdx {
	let idx = 0;
	for (let i = 0; i < m.types.length; i++) {
		idx += m.types[i].types.length;
	}
	m.types.push({ types });
	return typeIdx(idx);
}

export function addImport(m: Module, import_: Import): FuncIdx {
	m.imports.push(import_);
	return funcIdx(m.imports.length - 1);
}

/*
 * Imports must be declared first since
 * > The index space for tags, globals, memories, tables, and functions includes respective imports declared in the
 * > same module. The indices of these imports precede the indices of other definitions in the same index space.
 */

export function addFunc(m: Module, func: Func): FuncIdx {
	m.funcs.push(func);
	return funcIdx(m.imports.length + m.funcs.length - 1);
}

export function declareLocal(func: Func, valType: ValType): LocalIdx {
	func.locals.push(valType);
	return localIdx(func.locals.length - 1);
}

export function addGlobal(m: Module, global: Global): GlobalIdx {
	m.globals.push(global);
	return globalIdx(m.imports.length + m.globals.length - 1);
}

export function addFuncExport(m: Module, name: string, funcidx: FuncIdx) {
	m.exports.push({ name, desc: { kind: "func", index: funcidx } });
}

export function declareFuncs(m: Module) {
	const funcs = m.funcs.map((_, i) => funcIdx(m.imports.length + i));
	m.elems.push({ declarative: true, funcs });
}
