export type JoinStyle = "square" | "round";
export type HatStyle = JoinStyle | "flat";
export type HatOptions = { style: HatStyle; offset: number; width: number };
export type ConnectionOptions = {
	joinStyle: JoinStyle;
	above: HatOptions;
	below: HatOptions;
};

const PIPE = "";
const VERTICAL_RIGHT = "├";
const VERTICAL_LEFT = "┤";

const CORNER: Record<JoinStyle, { topLeft: string; topRight: string; bottomLeft: string; bottomRight: string }> = {
	square: {
		topLeft: "┌",
		topRight: "┐",
		bottomLeft: "└",
		bottomRight: "┘",
	},
	round: {
		topLeft: "╭",
		topRight: "╮",
		bottomLeft: "╰",
		bottomRight: "╯",
	},
};

type Segment = { column: number; glyphs: string };

export function hat({ style, offset, width }: HatOptions, isAbove: boolean, biasLeft: boolean): Segment {
	const column = Math.max(0, offset);
	if (width <= 1) return { column, glyphs: "│" };
	if (width === 2) {
		style = style === "flat" ? "square" : style;
		if (biasLeft)
			return { column, glyphs: VERTICAL_RIGHT + (isAbove ? CORNER[style].bottomRight : CORNER[style].topRight) };
		return { column, glyphs: (isAbove ? CORNER[style].bottomLeft : CORNER[style].topLeft) + VERTICAL_LEFT };
	}
	const middle = isAbove ? "┬" : "┴";
	let lcorner: string, rcorner: string;
	switch (style) {
		case "flat":
			lcorner = rcorner = "─";
			break;
		default:
			lcorner = isAbove ? CORNER[style].bottomLeft : CORNER[style].topLeft;
			rcorner = isAbove ? CORNER[style].bottomRight : CORNER[style].topRight;
			break;
	}
	const l = (biasLeft ? Math.floor : Math.ceil)((width - 3) / 2);
	const r = (biasLeft ? Math.ceil : Math.floor)((width - 3) / 2);
	return { column, glyphs: lcorner + "─".repeat(l) + middle + "─".repeat(r) + rcorner };
}

function joinHelper(style: JoinStyle, start: number, end: number): Segment {
	if (start === end) return { column: start, glyphs: "│" };
	if (start < end) {
		const lcorner = CORNER[style].bottomLeft;
		const rcorner = CORNER[style].topRight;
		return { column: start, glyphs: lcorner + "─".repeat(end - start - 1) + rcorner };
	}
	const lcorner = CORNER[style].topLeft;
	const rcorner = CORNER[style].bottomRight;
	return { column: end, glyphs: lcorner + "─".repeat(start - end - 1) + rcorner };
}

export function join(
	{ joinStyle, above, below }: ConnectionOptions,
	aboveLeftBiased: boolean,
	belowLeftBiased: boolean,
) {
	return joinHelper(
		joinStyle,
		above.offset + (aboveLeftBiased ? Math.floor : Math.ceil)((above.width - 1) / 2),
		below.offset + (belowLeftBiased ? Math.floor : Math.ceil)((below.width - 1) / 2),
	);
}

export function connectionLines(options: ConnectionOptions): [Segment, Segment, Segment] {
	const awl2 = Math.floor((options.above.width - 1) / 2);
	const awh2 = Math.ceil((options.above.width - 1) / 2);
	const bwl2 = Math.floor((options.below.width - 1) / 2);
	const bwh2 = Math.ceil((options.below.width - 1) / 2);
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
	if (width < 3) return "─";
	return "└" + "─".repeat(width - 2) + "┘";
}
