export const enum TokenKind {
	EOF,
	LeftParen,
	RightParen,
	Unit,
	Int,
	Identifier,
	Lambda,
	Period,
	Tilde,
	Bang,
	Plus,
	Minus,
	Times,
	Slash,
	Lt,
	Gt,
	Lte,
	Gte,
	Amp,
	AmpAmp,
	Pipe,
	PipePipe,
	True,
	False,
	Let,
	Rec,
	Equals,
	EqualsEquals,
	In,
	If,
	Then,
	Else,
}

export type TokenInt = { kind: TokenKind.Int; value: number };
export type TokenIdent = { kind: TokenKind.Identifier; name: string };
export type Token = TokenInt | TokenIdent | { kind: Exclude<TokenKind, TokenKind.Int | TokenKind.Identifier> };

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
		case TokenKind.Tilde:
			return "tilde";
		case TokenKind.Bang:
			return "bang";
		case TokenKind.Plus:
			return "plus";
		case TokenKind.Minus:
			return "minus";
		case TokenKind.Times:
			return "times";
		case TokenKind.Slash:
			return "slash";
		case TokenKind.Lt:
			return "lt";
		case TokenKind.Gt:
			return "gt";
		case TokenKind.Lte:
			return "lte";
		case TokenKind.Gte:
			return "gte";
		case TokenKind.Amp:
			return "amp";
		case TokenKind.AmpAmp:
			return "amp-amp";
		case TokenKind.Pipe:
			return "pipe";
		case TokenKind.PipePipe:
			return "pipe-pipe";
		case TokenKind.True:
			return "true";
		case TokenKind.False:
			return "false";
		case TokenKind.Let:
			return "let";
		case TokenKind.Rec:
			return "rec";
		case TokenKind.Equals:
			return "equals";
		case TokenKind.EqualsEquals:
			return "equals-equals";
		case TokenKind.In:
			return "in";
		case TokenKind.If:
			return "if";
		case TokenKind.Then:
			return "then";
		case TokenKind.Else:
			return "else";
	}
}

export const enum Char {
	Tab = 9,
	Newline = 10,
	Carriage = 13,
	Space = 32,
	Bang = 33,
	Amp = 38,
	LParen = 40,
	RParen = 41,
	Star = 42,
	Plus = 43,
	Dash = 45,
	Slash = 47,
	Period = 46,
	Less = 60,
	Equals = 61,
	Greater = 62,
	Backslash = 92,
	Underscore = 95,
	Pipe = 124,
	Tilde = 126,
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

	protected getNextToken(): Token {
		if (this.eof()) {
			return { kind: TokenKind.EOF };
		}
		switch (this.char()) {
			case Char.Backslash:
			case Char.Lambda:
				this.advance();
				return { kind: TokenKind.Lambda };
			case Char.Period:
				this.advance();
				return { kind: TokenKind.Period };
			case Char.Bang:
				this.advance();
				return { kind: TokenKind.Bang };
			case Char.Plus:
				this.advance();
				return { kind: TokenKind.Plus };
			case Char.Dash:
				this.advance();
				return { kind: TokenKind.Minus };
			case Char.Star:
				this.advance();
				return { kind: TokenKind.Times };
			case Char.Slash:
				this.advance();
				return { kind: TokenKind.Slash };
			case Char.Tilde:
				this.advance();
				return { kind: TokenKind.Tilde };
			case Char.Equals:
				this.advance();
				if (this.char() === Char.Equals) {
					this.advance();
					return { kind: TokenKind.EqualsEquals };
				}
				return { kind: TokenKind.Equals };
			case Char.Less:
				this.advance();
				if (this.char() === Char.Equals) {
					this.advance();
					return { kind: TokenKind.Lte };
				}
				return { kind: TokenKind.Lt };
			case Char.Greater:
				this.advance();
				if (this.char() === Char.Equals) {
					this.advance();
					return { kind: TokenKind.Gte };
				}
				return { kind: TokenKind.Gt };
			case Char.Amp:
				this.advance();
				if (this.char() === Char.Amp) {
					this.advance();
					return { kind: TokenKind.AmpAmp };
				}
				return { kind: TokenKind.Amp };
			case Char.Pipe:
				this.advance();
				if (this.char() === Char.Pipe) {
					this.advance();
					return { kind: TokenKind.PipePipe };
				}
				return { kind: TokenKind.Pipe };
			case Char.LParen:
				this.advance();
				if (this.char() === Char.RParen) {
					this.advance();
					return { kind: TokenKind.Unit };
				}
				return { kind: TokenKind.LeftParen };
			case Char.RParen:
				this.advance();
				return { kind: TokenKind.RightParen };
		}
		return this.intOrIdentifier();
	}

	protected intOrIdentifier(): Token {
		let c = this.char();
		if (c === 48) {
			this.advance();
			return { kind: TokenKind.Int, value: 0 };
		}
		const start = this.index;
		if (49 <= c && c <= 57) {
			this.advance();
			c = this.char();
			while (48 <= c && c <= 57) {
				this.advance();
				c = this.char();
			}
			return {
				kind: TokenKind.Int,
				value: Number.parseInt(this.input.slice(start, this.index)),
			};
		}
		if ((65 <= c && c <= 90) || (97 <= c && c <= 122)) {
			this.advance();
			c = this.char();
			while ((65 <= c && c <= 90) || (97 <= c && c <= 122) || c === Char.Underscore) {
				this.advance();
				c = this.char();
			}
			const name = this.input.slice(start, this.index);
			switch (name) {
				case "true":
					return { kind: TokenKind.True };
				case "false":
					return { kind: TokenKind.False };
				case "let":
					return { kind: TokenKind.Let };
				case "rec":
					return { kind: TokenKind.Rec };
				case "in":
					return { kind: TokenKind.In };
				case "if":
					return { kind: TokenKind.If };
				case "then":
					return { kind: TokenKind.Then };
				case "else":
					return { kind: TokenKind.Else };
				default:
					return { kind: TokenKind.Identifier, name };
			}
		}
		throw new Error(`Tokenizer error @ (${this.row}, ${this.col})`);
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
