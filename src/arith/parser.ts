import * as ast from "./surface";
import { Token, Tokenizer, TokenKind } from "./tokenizer";

const PREFIX_RBP = 3;
const APPLICATION_LBP = 5;
const APPLICATION_RBP = 6;

export class Parser {
	protected stream: Tokenizer = new Tokenizer();

	parse(input: string): ast.Expression {
		this.stream.setInput(input);
		const expr = this.expression(0);
		this.expect(TokenKind.EOF);
		return expr;
	}

	protected expression(minBp: number): ast.Expression {
		let left = this.atom();
		while (true) {
			const op = this.stream.peek().kind;
			if (this.startsAtom(op)) {
				if (APPLICATION_LBP <= minBp) {
					return left;
				}
				left = ast.application(left, this.expression(APPLICATION_RBP));
				continue;
			}
			const [lbp, rbp] = Parser.binaryPrecedence(op);
			if (lbp <= minBp) {
				return left;
			}
			this.stream.next();
			const right = this.expression(rbp);
			left = this.binary(op, left, right);
		}
	}

	protected static binaryPrecedence(kind: TokenKind): [number, number] {
		switch (kind) {
			case TokenKind.Plus:
			case TokenKind.Minus:
				return [1, 2];
			case TokenKind.Times:
				return [3, 4];
			default:
				return [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
		}
	}

	protected binary(kind: TokenKind, left: ast.Expression, right: ast.Expression): ast.Expression {
		switch (kind) {
			case TokenKind.Plus:
				return ast.add(left, right);
			case TokenKind.Minus:
				return ast.sub(left, right);
			case TokenKind.Times:
				return ast.mul(left, right);
			default:
				throw new Error("Not a binary operator");
		}
	}

	// first set of `atom`, excluding prefix operators so that `f - x` parses correctly
	protected startsAtom(kind: TokenKind): boolean {
		switch (kind) {
			case TokenKind.Unit:
			case TokenKind.Int:
			case TokenKind.Identifier:
			case TokenKind.Lambda:
			case TokenKind.Let:
			case TokenKind.LeftParen:
				return true;
			default:
				return false;
		}
	}

	protected atom(): ast.Expression {
		const tok = this.stream.next();
		switch (tok.kind) {
			case TokenKind.Unit:
				return ast.unit();
			case TokenKind.Int:
				return ast.int(tok.value);
			case TokenKind.Identifier:
				return ast.variable(tok.name);
			case TokenKind.Lambda:
				return this.abstraction();
			case TokenKind.Let:
				return this.letIn();
			case TokenKind.Minus:
				return ast.negate(this.expression(PREFIX_RBP));
			case TokenKind.LeftParen: {
				const expr = this.expression(0);
				this.expect(TokenKind.RightParen);
				return expr;
			}
			case TokenKind.EOF:
				throw new Error("Parse error, unexpected EOF");
			default:
				throw new Error("Unexpected token kind");
		}
	}

	protected abstraction(): ast.Expression {
		// already read lambda
		const variable = this.expect(TokenKind.Identifier);
		this.expect(TokenKind.Period);
		const body = this.expression(0);
		return ast.abstraction(variable.name, body);
	}

	protected letIn(): ast.Expression {
		// already read let
		const variable = this.expect(TokenKind.Identifier);
		this.expect(TokenKind.Equals);
		const expr = this.expression(0);
		this.expect(TokenKind.In);
		const body = this.expression(0);
		return ast.letIn(variable.name, expr, body);
	}

	protected expect<T extends TokenKind>(kind: T): Token & { kind: T } {
		const tok = this.stream.next();
		if (tok.kind !== kind) {
			throw new Error("Parse error, not the expected token kind");
		}
		return tok as Token & { kind: T };
	}
}
