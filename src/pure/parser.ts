import * as ast from "./surface";
import { Token, Tokenizer, TokenKind, tokenKindToString } from "./tokenizer";

export class Parser {
	protected stream: Tokenizer = new Tokenizer();

	parse(input: string): ast.Expression {
		this.stream.setInput(input);
		const expr = this.expression();
		this.expect(TokenKind.EOF);
		return expr;
	}

	protected expression(): ast.Expression {
		let left = this.atom();
		while (this.startsAtom(this.stream.peek().kind)) {
			left = ast.application(left, this.atom());
		}
		return left;
	}

	protected startsAtom(kind: TokenKind): boolean {
		switch (kind) {
			case TokenKind.Identifier:
			case TokenKind.Lambda:
			case TokenKind.LeftParen:
				return true;
			default:
				return false;
		}
	}

	protected atom(): ast.Expression {
		const tok = this.stream.next();
		switch (tok.kind) {
			case TokenKind.Identifier:
				return ast.variable(tok.name);
			case TokenKind.Lambda:
				return this.abstraction();
			case TokenKind.LeftParen: {
				const expr = this.expression();
				this.expect(TokenKind.RightParen);
				return expr;
			}
			case TokenKind.EOF:
				this.croak(tok, "unexpected EOF");
			default:
				this.croak(tok, `unexpected ${tokenKindToString(tok.kind)}`);
		}
	}

	protected abstraction(): ast.Expression {
		// already read lambda
		const variable = this.expect(TokenKind.Identifier);
		this.expect(TokenKind.Period);
		const body = this.expression();
		return ast.abstraction(variable.name, body);
	}

	protected expect<T extends TokenKind>(kind: T): Token & { kind: T } {
		const tok = this.stream.next();
		if (tok.kind !== kind) {
			this.croak(tok, `expected ${tokenKindToString(kind)} but got ${tokenKindToString(tok.kind)}`);
		}
		return tok as Token & { kind: T };
	}

	protected croak(tok: Token, message: string): never {
		throw new Error(`Parse error @ (${tok.start.row}, ${tok.start.col}): ${message}`);
	}
}
