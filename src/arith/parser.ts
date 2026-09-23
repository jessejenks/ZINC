import * as ast from "./surface";
import { Token, Tokenizer, TokenKind, tokenKindToString } from "./tokenizer";

type InfixBindingPower = { lbp: number; rbp: number };

const PREFIX_RBP = 3;
const APPLICATION_LBP = 5;
const APPLICATION_RBP = 6;

const TOKEN_TO_BINARY: Map<TokenKind, ast.BinaryOp> = new Map([
	[TokenKind.Plus, ast.BinaryOp.Add],
	[TokenKind.Minus, ast.BinaryOp.Sub],
	[TokenKind.Times, ast.BinaryOp.Mul],
]);

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
			const tok = this.stream.peek();
			if (this.startsAtom(tok.kind)) {
				if (APPLICATION_LBP <= minBp) {
					return left;
				}
				left = ast.application(left, this.expression(APPLICATION_RBP));
				continue;
			}
			const op = TOKEN_TO_BINARY.get(tok.kind);
			if (op === undefined) {
				return left;
			}
			const bp = Parser.infixBindingPower(op);
			if (bp.lbp <= minBp) {
				return left;
			}
			this.stream.next();
			const right = this.expression(bp.rbp);
			left = ast.binary(op, left, right);
		}
	}

	protected static infixBindingPower(op: ast.BinaryOp): InfixBindingPower {
		switch (op) {
			case ast.BinaryOp.Add:
			case ast.BinaryOp.Sub:
				return { lbp: 1, rbp: 2 };
			case ast.BinaryOp.Mul:
				return { lbp: 3, rbp: 4 };
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
				return ast.unary(ast.UnaryOp.Negate, this.expression(PREFIX_RBP));
			case TokenKind.LeftParen: {
				const expr = this.expression(0);
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
			this.croak(tok, `expected ${tokenKindToString(kind)} but got ${tokenKindToString(tok.kind)}`);
		}
		return tok as Token & { kind: T };
	}

	protected croak(tok: Token, message: string): never {
		throw new Error(`Parse error @ (${tok.start.row}, ${tok.start.col}): ${message}`);
	}
}
