import * as ast from "./surface";
import { Token, Tokenizer, TokenKind, tokenKindToString } from "./tokenizer";

type InfixBindingPower = { lbp: number; rbp: number; nonAssociative?: boolean };

const PREFIX_RBP = 9;
const APPLICATION_LBP = 11;
const APPLICATION_RBP = 12;

const TOKEN_TO_BINARY: Map<TokenKind, ast.BinaryOp> = new Map([
	[TokenKind.Plus, ast.BinaryOp.Add],
	[TokenKind.Minus, ast.BinaryOp.Sub],
	[TokenKind.Times, ast.BinaryOp.Mul],
	[TokenKind.Slash, ast.BinaryOp.Div],
	[TokenKind.Lt, ast.BinaryOp.Lt],
	[TokenKind.Gt, ast.BinaryOp.Gt],
	[TokenKind.Lte, ast.BinaryOp.Lte],
	[TokenKind.Gte, ast.BinaryOp.Gte],
	[TokenKind.EqualsEquals, ast.BinaryOp.Eq],
	[TokenKind.Amp, ast.BinaryOp.BitAnd],
	[TokenKind.Pipe, ast.BinaryOp.BitOr],
	[TokenKind.AmpAmp, ast.BinaryOp.And],
	[TokenKind.PipePipe, ast.BinaryOp.Or],
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
			const peek = this.stream.peek();
			if (bp.nonAssociative && TOKEN_TO_BINARY.has(peek.kind)) {
				const next = Parser.infixBindingPower(TOKEN_TO_BINARY.get(peek.kind)!);
				if (next.nonAssociative && next.lbp === bp.lbp) {
					this.croak(peek, `non-associative operator ${tokenKindToString(peek.kind)} cannot be chained`);
				}
			}
		}
	}

	protected static infixBindingPower(op: ast.BinaryOp): InfixBindingPower {
		switch (op) {
			case ast.BinaryOp.Or:
				return { lbp: 1, rbp: 2 };
			case ast.BinaryOp.And:
				return { lbp: 3, rbp: 4 };
			case ast.BinaryOp.Lt:
			case ast.BinaryOp.Gt:
			case ast.BinaryOp.Lte:
			case ast.BinaryOp.Gte:
			case ast.BinaryOp.Eq:
				return { lbp: 5, rbp: 6, nonAssociative: true };
			case ast.BinaryOp.Add:
			case ast.BinaryOp.Sub:
			case ast.BinaryOp.BitOr:
				return { lbp: 7, rbp: 8 };
			case ast.BinaryOp.Mul:
			case ast.BinaryOp.Div:
			case ast.BinaryOp.BitAnd:
				return { lbp: 9, rbp: 10 };
		}
	}

	// first set of `atom`, excluding negation so that `f - x` parses as (- f x) instead of `f (-x)`
	protected startsAtom(kind: TokenKind): boolean {
		switch (kind) {
			case TokenKind.Unit:
			case TokenKind.True:
			case TokenKind.False:
			case TokenKind.Int:
			case TokenKind.Identifier:
			case TokenKind.Lambda:
			case TokenKind.Let:
			case TokenKind.If:
			case TokenKind.Bang:
			case TokenKind.Tilde:
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
			case TokenKind.True:
				return ast.bool(true);
			case TokenKind.False:
				return ast.bool(false);
			case TokenKind.Int:
				return ast.int(tok.value);
			case TokenKind.Identifier:
				return ast.variable(tok.name);
			case TokenKind.Lambda:
				return this.abstraction();
			case TokenKind.Let:
				return this.letIn();
			case TokenKind.If:
				return this.ifElse();
			case TokenKind.Minus:
				return ast.unary(ast.UnaryOp.Negate, this.expression(PREFIX_RBP));
			case TokenKind.Tilde:
				return ast.unary(ast.UnaryOp.BitNot, this.expression(PREFIX_RBP));
			case TokenKind.Bang:
				return ast.unary(ast.UnaryOp.Not, this.expression(PREFIX_RBP));
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
		let isRecursive = false;
		if (this.stream.peek().kind === TokenKind.Rec) {
			this.stream.next();
			isRecursive = true;
		}
		const variable = this.expect(TokenKind.Identifier);

		this.expect(TokenKind.Equals);
		const expr = this.expression(0);
		this.expect(TokenKind.In);
		const body = this.expression(0);
		return ast.letIn(variable.name, expr, body, isRecursive);
	}

	protected ifElse(): ast.Expression {
		// already read if
		const condition = this.expression(0);
		this.expect(TokenKind.Then);
		const consequence = this.expression(0);
		this.expect(TokenKind.Else);
		const alternative = this.expression(0);
		return ast.ifElse(condition, consequence, alternative);
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
