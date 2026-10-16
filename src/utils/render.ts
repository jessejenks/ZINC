import type { HatStyle, JoinStyle } from "./boxDrawing";
import { connectionLines, underbrace } from "./boxDrawing";

// NOTE: width of strings are assumed to be equal to `String.length`
export interface Writer<P> {
	width(p: P): number;
	write(p: P): void;
	connector(s: string): void;
	label(s: string): void;
	space(n: number): void;
	break(): void;
}

const piecesWidth = <P>(w: Writer<P>, pieces: P[]) => pieces.reduce((n, p) => n + w.width(p), 0);

function writePieces<P>(w: Writer<P>, pieces: P[]) {
	for (const p of pieces) w.write(p);
}

export function writeDrawing<P>(w: Writer<P>, line: string) {
	const trimmed = line.trimStart();
	w.space(line.length - trimmed.length);
	w.connector(trimmed);
}

export type Frame<P> = { prefix: P[]; suffix: P[]; label?: string };
export type Row<P> = { frames: Frame<P>[]; focus: P[] }; // frames are innermost first
export type Step<P> = { label?: string; before: Row<P>; after: Row<P> };
export type Span = { start: number; end: number };

function nested<P>({ frames, focus }: Row<P>, depth = frames.length): P[] {
	const inner = frames.slice(0, depth);
	const suffices = inner.flatMap((f) => f.suffix);
	inner.reverse();
	const prefixes = inner.flatMap((f) => f.prefix);
	return [...prefixes, ...focus, ...suffices];
}

function layout<P>(w: Writer<P>, { frames, focus }: Row<P>): { spans: Span[]; focus: Span } {
	let width = piecesWidth(w, focus);
	if (frames.length === 0) {
		return { spans: [], focus: { start: 0, end: width } };
	}
	const spans = new Array<Span>(frames.length);
	for (let i = 0; i < frames.length; i++) {
		const prefixWidth = piecesWidth(w, frames[i].prefix);
		spans[i] = { start: 0, end: width };
		for (let j = 0; j <= i; j++) {
			spans[j].start += prefixWidth;
			spans[j].end += prefixWidth;
		}
		width += prefixWidth + piecesWidth(w, frames[i].suffix);
	}
	return { spans, focus: spans[0] };
}

export type RenderOptions = {
	expand?: boolean;
	gutterWidth?: number;
	withGutterLabel?: boolean;
	withReductionLabel?: boolean;
	joinStyle?: JoinStyle;
	aboveStyle?: HatStyle;
	belowStyle?: HatStyle;
};

export function renderDerivation<P>(
	w: Writer<P>,
	steps: Step<P>[],
	{
		expand = false,
		gutterWidth = 0,
		withGutterLabel = true,
		withReductionLabel = true,
		joinStyle = "square",
		aboveStyle = "flat",
		belowStyle = "flat",
	}: RenderOptions = {},
) {
	const gutter = (label?: string) => {
		if (label) w.label(label);
		w.space(gutterWidth - (label?.length ?? 0));
	};
	const layouts = steps.map((s) => ({ b: layout(w, s.before), a: layout(w, s.after) }));
	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		const { b, a } = layouts[i];
		gutter();
		writePieces(w, nested(step.before));
		w.break();
		if (expand) {
			for (let j = b.spans.length - 1; j >= 0; j--) {
				const { start, end } = b.spans[j];
				gutter();
				w.space(start);
				writePieces(w, nested(step.before, j));
				w.break();
				if (j > 0) {
					if (withGutterLabel) {
						gutter(step.before.frames[j].label);
					} else {
						gutter();
					}
					w.space(start);
					writeDrawing(w, underbrace(end - start));
					w.break();
				}
			}
		}
		const [top, middle, bottom] = connectionLines({
			joinStyle,
			above: { style: aboveStyle, offset: b.focus.start, width: b.focus.end - b.focus.start },
			below: { style: belowStyle, offset: a.focus.start, width: a.focus.end - a.focus.start },
		});
		gutter(expand && withGutterLabel ? step.before.frames[0]?.label : undefined);
		w.space(top.column);
		writeDrawing(w, top.glyphs);
		w.break();
		gutter();
		w.space(middle.column);
		writeDrawing(w, middle.glyphs);
		if (withReductionLabel && step.label) {
			w.space(1);
			w.label(step.label);
		}
		w.break();
		gutter();
		w.space(bottom.column);
		writeDrawing(w, bottom.glyphs);
		w.break();
		if (i === steps.length - 1) {
			gutter();
			writePieces(w, nested(step.after));
			w.break();
		}
	}
}

export type Printer<T, F, P> = {
	print: (t: T) => P[];
	printFrame: (f: F, child: T) => Frame<P>;
};

// `print` must emit `marker` for `hole`
export function holePrinter<T extends object, F, P>(
	print: (t: T, hole?: T) => P[],
	plug: Plug<T, F>,
	marker: P,
	label: (f: F) => string,
): Printer<T, F, P> {
	return {
		print,
		printFrame: (f, child) => {
			const hole = { ...child };
			const pieces = print(plug(f, hole), hole);
			const i = pieces.indexOf(marker);
			if (i < 0) throw new Error("hole was not printed");
			return { prefix: pieces.slice(0, i), suffix: pieces.slice(i + 1), label: label(f) };
		},
	};
}

export type Plug<T, F> = (f: F, child: T) => T;

export type Decompose<T, D, F> = (t: T, d: D) => [F, T];

// frames are outermost first
export const plugAll = <T, F, P>(plug: Plug<T, F>, printer: Printer<T, F, P>, t: T, frames: F[]): [Row<P>, T] => {
	const row: Row<P> = { frames: new Array(frames.length), focus: printer.print(t) };
	for (let i = frames.length - 1; i >= 0; i--) {
		row.frames[frames.length - 1 - i] = printer.printFrame(frames[i], t);
		t = plug(frames[i], t);
	}
	return [row, t];
};

export type Piece = { text: string; role?: string };

export const piece = (text: string, role?: string): [Piece] => [{ text, role }];
export const concat = (...parts: Piece[][]): Piece[] => parts.flat();

export function stringWriter(): Writer<Piece> & { output(): string } {
	const out: string[] = [];
	return {
		width: (p) => p.text.length,
		write: (p) => {
			out.push(p.text);
		},
		connector: (s) => {
			out.push(s);
		},
		label: (s) => {
			out.push(s);
		},
		space: (n) => {
			out.push(" ".repeat(Math.max(0, n)));
		},
		break: () => out.push("\n"),
		output: () => out.join(""),
	};
}
