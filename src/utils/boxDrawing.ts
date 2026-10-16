export type JoinStyle = "square" | "round";
export type HatStyle = JoinStyle | "flat";
export type HatOptions = { style: HatStyle; offset: number; width: number };
export type ConnectionOptions = {
	joinStyle: JoinStyle;
	above: HatOptions;
	below: HatOptions;
};

const HORIZONTAL = "─";
const VERTICAL = "│";
const VERTICAL_RIGHT = "├";
const VERTICAL_LEFT = "┤";
const DOWN_HORIZONTAL = "┬";
const UP_HORIZONTAL = "┴";

const CORNER: Record<JoinStyle, { downRight: string; downLeft: string; upRight: string; upLeft: string }> = {
	square: {
		downRight: "┌",
		downLeft: "┐",
		upRight: "└",
		upLeft: "┘",
	},
	round: {
		downRight: "╭",
		downLeft: "╮",
		upRight: "╰",
		upLeft: "╯",
	},
};

type Segment = { column: number; glyphs: string };

export function hat({ style, offset, width }: HatOptions, isAbove: boolean, biasLeft: boolean): Segment {
	const column = Math.max(0, offset);
	if (width <= 0) return { column, glyphs: VERTICAL };
	const middle = isAbove ? DOWN_HORIZONTAL : UP_HORIZONTAL;
	if (width === 1) return { column, glyphs: style === "flat" ? middle : VERTICAL };
	if (width === 2) {
		if (style === "flat") return { column, glyphs: biasLeft ? middle + HORIZONTAL : HORIZONTAL + middle };
		if (biasLeft) return { column, glyphs: VERTICAL_RIGHT + (isAbove ? CORNER[style].upLeft : CORNER[style].downLeft) };
		return { column, glyphs: (isAbove ? CORNER[style].upRight : CORNER[style].downRight) + VERTICAL_LEFT };
	}
	let lcorner: string, rcorner: string;
	switch (style) {
		case "flat":
			lcorner = rcorner = HORIZONTAL;
			break;
		default:
			lcorner = isAbove ? CORNER[style].upRight : CORNER[style].downRight;
			rcorner = isAbove ? CORNER[style].upLeft : CORNER[style].downLeft;
			break;
	}
	const l = (biasLeft ? Math.floor : Math.ceil)((width - 3) / 2);
	const r = (biasLeft ? Math.ceil : Math.floor)((width - 3) / 2);
	return { column, glyphs: lcorner + HORIZONTAL.repeat(l) + middle + HORIZONTAL.repeat(r) + rcorner };
}

function joinHelper(style: JoinStyle, start: number, end: number): Segment {
	if (start === end) return { column: start, glyphs: VERTICAL };
	if (start < end) {
		const lcorner = CORNER[style].upRight;
		const rcorner = CORNER[style].downLeft;
		return { column: start, glyphs: lcorner + HORIZONTAL.repeat(end - start - 1) + rcorner };
	}
	const lcorner = CORNER[style].downRight;
	const rcorner = CORNER[style].upLeft;
	return { column: end, glyphs: lcorner + HORIZONTAL.repeat(start - end - 1) + rcorner };
}

// zero-width hats are one column wide
const half = (width: number, round: (x: number) => number) => round((Math.max(1, width) - 1) / 2);

export function join(
	{ joinStyle, above, below }: ConnectionOptions,
	aboveLeftBiased: boolean,
	belowLeftBiased: boolean,
) {
	return joinHelper(
		joinStyle,
		above.offset + half(above.width, aboveLeftBiased ? Math.floor : Math.ceil),
		below.offset + half(below.width, belowLeftBiased ? Math.floor : Math.ceil),
	);
}

export function connectionLines(options: ConnectionOptions): [Segment, Segment, Segment] {
	const awl2 = half(options.above.width, Math.floor);
	const awh2 = half(options.above.width, Math.ceil);
	const bwl2 = half(options.below.width, Math.floor);
	const bwh2 = half(options.below.width, Math.ceil);
	const aboveLeftBiased = options.above.offset + awh2 > options.below.offset + bwl2;
	const belowLeftBiased = options.below.offset + bwh2 > options.above.offset + awl2;
	return [
		hat(options.above, true, aboveLeftBiased),
		join(options, aboveLeftBiased, belowLeftBiased),
		hat(options.below, false, belowLeftBiased),
	];
}

export function connection(options: ConnectionOptions): string {
	return connectionLines(options)
		.map((s) => s.glyphs)
		.join("\n");
}

export function underbrace(width: number): string {
	if (width < 3) return HORIZONTAL;
	return CORNER.square.upRight + HORIZONTAL.repeat(width - 2) + CORNER.square.upLeft;
}
