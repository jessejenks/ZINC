export const enum TokenKind {
	EOF,
	LeftParen,
	RightParen,
	Identifier,
	Lambda,
	Period,
}

export type TokenIdent = { kind: TokenKind.Identifier; name: string };
type TokenData = TokenIdent | { kind: Exclude<TokenKind, TokenKind.Identifier> };
export type Position = { row: number; col: number };
export type Token = TokenData & { start: Position };

export function tokenKindToString(kind: TokenKind): string {
	switch (kind) {
		case TokenKind.EOF:
			return "<eof>";
		case TokenKind.LeftParen:
			return "left-paren";
		case TokenKind.RightParen:
			return "right-paren";
		case TokenKind.Identifier:
			return "identifier";
		case TokenKind.Lambda:
			return "lambda";
		case TokenKind.Period:
			return "period";
	}
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

	protected getNextToken(): Token {
		this.skipWhiteSpace();
		const start = { row: this.row, col: this.col };
		return { ...this.readToken(), start };
	}

	protected readToken(): TokenData {
		if (this.index >= this.input.length) {
			return { kind: TokenKind.EOF };
		}
		switch (this.char()) {
			case "\\":
			case "λ":
				this.advance();
				return { kind: TokenKind.Lambda };
			case ".":
				this.advance();
				return { kind: TokenKind.Period };
			case "(":
				this.advance();
				return { kind: TokenKind.LeftParen };
			case ")":
				this.advance();
				return { kind: TokenKind.RightParen };
		}
		return this.identifier();
	}

	protected identifier(): TokenData {
		let c = this.char();
		const start = this.index;
		if (("A" <= c && c <= "Z") || ("a" <= c && c <= "z")) {
			this.advance();
			c = this.char();
			while (("A" <= c && c <= "Z") || ("a" <= c && c <= "z") || c === "_") {
				this.advance();
				c = this.char();
			}
			while (c === "'") {
				this.advance();
				c = this.char();
			}
			return { kind: TokenKind.Identifier, name: this.input.slice(start, this.index) };
		}
		throw new Error(`Tokenizer error @ (${this.row}, ${this.col})`);
	}

	protected skipWhiteSpace() {
		while (this.index < this.input.length) {
			switch (this.char()) {
				case " ":
				case "\t":
				case "\r":
					this.advance();
					break;
				case "\n":
					this.advanceLine();
					break;
				default:
					return;
			}
		}
	}

	protected char(): string {
		return this.input[this.index] ?? "";
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
