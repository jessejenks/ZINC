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

export type TokenInt = { kind: TokenKind.Int; value: number };
export type TokenIdent = { kind: TokenKind.Identifier; name: string };
type TokenData = TokenInt | TokenIdent | { kind: Exclude<TokenKind, TokenKind.Int | TokenKind.Identifier> };
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
		case TokenKind.Unit:
			return "unit";
		case TokenKind.Int:
			return "int";
		case TokenKind.Identifier:
			return "identifier";
		case TokenKind.Lambda:
			return "lambda";
		case TokenKind.Period:
			return "period";
		case TokenKind.Plus:
			return "plus";
		case TokenKind.Minus:
			return "minus";
		case TokenKind.Times:
			return "times";
		case TokenKind.Let:
			return "let";
		case TokenKind.Equals:
			return "equals";
		case TokenKind.In:
			return "in";
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
			case "+":
				this.advance();
				return { kind: TokenKind.Plus };
			case "-":
				this.advance();
				return { kind: TokenKind.Minus };
			case "*":
				this.advance();
				return { kind: TokenKind.Times };
			case "=":
				this.advance();
				return { kind: TokenKind.Equals };
			case "(":
				this.advance();
				if (this.char() === ")") {
					this.advance();
					return { kind: TokenKind.Unit };
				}
				return { kind: TokenKind.LeftParen };
			case ")":
				this.advance();
				return { kind: TokenKind.RightParen };
		}
		return this.intOrIdentifier();
	}

	protected intOrIdentifier(): TokenData {
		let c = this.char();
		if (c === "0") {
			this.advance();
			return { kind: TokenKind.Int, value: 0 };
		}
		const start = this.index;
		if ("1" <= c && c <= "9") {
			this.advance();
			c = this.char();
			while ("0" <= c && c <= "9") {
				this.advance();
				c = this.char();
			}
			return {
				kind: TokenKind.Int,
				value: Number.parseInt(this.input.slice(start, this.index)),
			};
		}
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
			const name = this.input.slice(start, this.index);
			switch (name) {
				case "let":
					return { kind: TokenKind.Let };
				case "in":
					return { kind: TokenKind.In };
				default:
					return { kind: TokenKind.Identifier, name };
			}
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
