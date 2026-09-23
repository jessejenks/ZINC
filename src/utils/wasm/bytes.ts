export function hexDump(bytes: Uint8Array, cols = 16) {
	console.log(`${bytes.length} bytes`);
	if (bytes.length === 0) {
		console.log("00000000 :");
		return;
	}
	const row = new Array<string>(cols).fill("  ");
	let idx = 0;
	let i = 0;
	for (i = 0; i < bytes.length; i++) {
		idx = i % cols;
		if (i > 0 && idx === 0) {
			console.log((i - cols).toString().padStart(8, "0"), ":", row.join(" "));
			row.fill("  ");
		}
		row[idx] = bytes[i].toString(16).padStart(2, "0");
	}
	console.log((bytes.length - (bytes.length % cols || cols)).toString().padStart(8, "0"), ":", row.join(" "));
}

// TODO floats

export class ByteWriter {
	protected static MASK = 0b01111111n;
	protected static CONTINUATION = 0b10000000;

	protected buf: number[] = [];

	finish(): Uint8Array<ArrayBuffer> {
		const out = new Uint8Array(new ArrayBuffer(this.buf.length));
		out.set(this.buf);
		return out;
	}

	u8(b: number) {
		this.buf.push(b);
	}

	bytes(bs: ArrayLike<number>) {
		for (let i = 0; i < bs.length; i++) {
			this.buf.push(bs[i]);
		}
	}

	sized(inner: ByteWriter) {
		this.u32(inner.buf.length);
		this.bytes(inner.buf);
	}

	string(s: string) {
		const utf8 = new TextEncoder().encode(s);
		this.u32(utf8.length);
		this.bytes(utf8);
	}

	u32(v: number | bigint) {
		this.unsigned(BigInt(v));
	}

	i32(v: number | bigint) {
		this.signed(BigInt(v));
	}

	i64(v: bigint) {
		this.signed(v);
	}

	s33(v: number | bigint) {
		this.signed(BigInt(v));
	}

	protected unsigned(val: bigint) {
		let more = true;
		while (more) {
			const b = Number(val & ByteWriter.MASK);
			val >>= 7n;
			more = val !== 0n;
			this.buf.push(more ? b | ByteWriter.CONTINUATION : b);
		}
	}

	protected signed(val: bigint) {
		let more = true;
		while (more) {
			const b = Number(val & ByteWriter.MASK);
			const signBitSet = b & 0x40;
			val >>= 7n;
			if ((val === 0n && !signBitSet) || (val === -1n && signBitSet)) {
				more = false;
				this.buf.push(b);
			} else {
				this.buf.push(b | ByteWriter.CONTINUATION);
			}
		}
	}
}

export class ByteReader {
	protected static MASK = 0b01111111;
	protected static CONTINUATION = 0b10000000;

	static u8(bytes: Uint8Array<ArrayBuffer>, start: number): number {
		return bytes[start];
	}

	static string(bytes: Uint8Array<ArrayBuffer>, start: number): [number, string] {
		const [numBytes, length] = ByteReader.u32(bytes, start);
		const lengthNum = Number(length);
		const chars = new Uint8Array(lengthNum);
		for (let i = 0; i < lengthNum; i++) {
			chars[i] = bytes[start + numBytes + i];
		}
		return [numBytes + lengthNum, new TextDecoder().decode(chars)];
	}

	static u32(bytes: Uint8Array<ArrayBuffer>, start: number): [number, bigint] {
		return ByteReader.unsigned(bytes, start, 5);
	}

	static i32(bytes: Uint8Array<ArrayBuffer>, start: number): [number, bigint] {
		return ByteReader.signed(bytes, start, 5);
	}

	static i64(bytes: Uint8Array<ArrayBuffer>, start: number): [number, bigint] {
		return ByteReader.signed(bytes, start, 10);
	}

	static s33(bytes: Uint8Array<ArrayBuffer>, start: number): [number, bigint] {
		return ByteReader.signed(bytes, start, 5);
	}

	protected static unsigned(bytes: Uint8Array<ArrayBuffer>, start: number, maxBytes: number): [number, bigint] {
		let i = 0;
		while (bytes[start + i] & ByteReader.CONTINUATION) {
			i++;
			if (maxBytes && i > maxBytes) {
				throw new Error("More bytes than expected");
			}
		}
		const length = i + 1;
		let v = 0n;
		while (i >= 0) {
			v <<= 7n;
			v |= BigInt(bytes[start + i] & ByteReader.MASK);
			i--;
		}
		return [length, v];
	}

	protected static signed(bytes: Uint8Array<ArrayBuffer>, start: number, maxBytes: number): [number, bigint] {
		let i = 0;
		while (bytes[start + i] & ByteReader.CONTINUATION) {
			i++;
			if (maxBytes && i > maxBytes) {
				throw new Error("More bytes than expected");
			}
		}
		let v = bytes[start + i] & 0x40 ? -1n : 0n;
		const length = i + 1;
		while (i >= 0) {
			v <<= 7n;
			v |= BigInt(bytes[start + i] & ByteReader.MASK);
			i--;
		}
		return [length, v];
	}
}
