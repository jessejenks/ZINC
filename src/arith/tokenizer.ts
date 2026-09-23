export type Position = { readonly index: number; readonly row: number; readonly col: number };

export const enum TokenKind {
	EOF,
	LeftParen,
	RightParen,
	Unit,
	Int,
	Identifier,
	Lambda,
	Period,
	Plus,
	Minus,
	Times,
	Let,
	Equals,
	In,
}

interface WithRange {
	range: [Position, Position];
}

export type TokenInt = { kind: TokenKind.Int; value: number } & WithRange;
export type TokenIdent = { kind: TokenKind.Identifier; name: string } & WithRange;
export type Token =
	| TokenInt
	| TokenIdent
	| ({
			kind:
				| TokenKind.LeftParen
				| TokenKind.RightParen
				| TokenKind.Unit
				| TokenKind.Lambda
				| TokenKind.Period
				| TokenKind.Plus
				| TokenKind.Minus
				| TokenKind.Times
				| TokenKind.Let
				| TokenKind.Equals
				| TokenKind.In;
	  } & WithRange)
	| { kind: TokenKind.EOF };

export const enum Char {
	Tab = 9,
	Newline = 10,
	Carriage = 13,
	Space = 32,
	LParen = 40,
	RParen = 41,
	Star = 42,
	Plus = 43,
	Dash = 45,
	Period = 46,
	Equals = 61,
	Backslash = 92,
	Underscore = 95,
	Lambda = 955,
}

export class Tokenizer {
	protected index: number = 0;
	protected row: number = 1;
	protected col: number = 1;
	protected currToken: Token | null = null;
	protected input: string = "";

	setInput(input: string) {
		this.index = 0;
		this.row = 1;
		this.col = 1;
		this.currToken = null;
		this.input = input;
	}

	eof(): boolean {
		if (this.currToken !== null) {
			return this.currToken.kind === TokenKind.EOF;
		}
		this.skipWhiteSpace();
		return this.index >= this.input.length;
	}

	peek(): Token {
		if (this.currToken === null) {
			this.currToken = this.getNextToken();
		}
		return this.currToken;
	}

	next(): Token {
		if (this.currToken === null) {
			return this.getNextToken();
		}
		const node = this.currToken;
		this.currToken = null;
		return node;
	}

	getPosition(): Position {
		return { index: this.index, row: this.row, col: this.col };
	}

	protected getNextToken(): Token {
		if (this.eof()) {
			return { kind: TokenKind.EOF };
		}
		const start = this.getPosition();
		switch (this.char()) {
			case Char.Backslash:
			case Char.Lambda:
				this.advance();
				return { kind: TokenKind.Lambda, range: [start, this.getPosition()] };
			case Char.Period:
				this.advance();
				return { kind: TokenKind.Period, range: [start, this.getPosition()] };
			case Char.Plus:
				this.advance();
				return { kind: TokenKind.Plus, range: [start, this.getPosition()] };
			case Char.Dash:
				this.advance();
				return { kind: TokenKind.Minus, range: [start, this.getPosition()] };
			case Char.Star:
				this.advance();
				return { kind: TokenKind.Times, range: [start, this.getPosition()] };
			case Char.Equals:
				this.advance();
				return { kind: TokenKind.Equals, range: [start, this.getPosition()] };
			case Char.LParen:
				this.advance();
				if (this.char() === Char.RParen) {
					this.advance();
					return { kind: TokenKind.Unit, range: [start, this.getPosition()] };
				}
				return { kind: TokenKind.LeftParen, range: [start, this.getPosition()] };
			case Char.RParen:
				this.advance();
				return { kind: TokenKind.RightParen, range: [start, this.getPosition()] };
		}
		return this.intOrIdentifier(start);
	}

	protected intOrIdentifier(start: Position): Token {
		let c = this.char();
		if (c === 48) {
			this.advance();
			return { kind: TokenKind.Int, value: 0, range: [start, this.getPosition()] };
		}
		if (49 <= c && c <= 57) {
			this.advance();
			c = this.char();
			while (48 <= c && c <= 57) {
				this.advance();
				c = this.char();
			}
			return {
				kind: TokenKind.Int,
				value: Number.parseInt(this.input.slice(start.index, this.index)),
				range: [start, this.getPosition()],
			};
		}
		if ((65 <= c && c <= 90) || (97 <= c && c <= 122)) {
			this.advance();
			c = this.char();
			while ((65 <= c && c <= 90) || (97 <= c && c <= 122) || c === Char.Underscore) {
				this.advance();
				c = this.char();
			}
			const name = this.input.slice(start.index, this.index);
			const range: [Position, Position] = [start, this.getPosition()];
			switch (name) {
				case "let":
					return { kind: TokenKind.Let, range };
				case "in":
					return { kind: TokenKind.In, range };
				default:
					return { kind: TokenKind.Identifier, name, range };
			}
		}
		throw new Error(`Tokenizer error @ ${start.index}: (${start.row}, ${start.col})`);
	}

	protected skipWhiteSpace() {
		while (this.index < this.input.length) {
			switch (this.char()) {
				case Char.Space:
				case Char.Tab:
				case Char.Carriage:
					this.advance();
					break;
				case Char.Newline:
					this.advanceLine();
					break;
				default:
					return;
			}
		}
	}

	protected char(): number {
		return this.input.charCodeAt(this.index);
	}

	protected advance() {
		this.index++;
		this.col++;
	}

	protected advanceLine() {
		this.index++;
		this.row++;
		this.col = 1;
	}
}
