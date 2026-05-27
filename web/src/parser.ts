// ── Recursive-descent expression parser ──────────────────────────────
// Tokenizer → AST → Evaluator.  No eval().  No external math libs.

// ── Token types ──────────────────────────────────────────────────────

export type TokenKind =
  | "NUMBER"
  | "IDENT"
  | "OP"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "EOF";

export interface Token {
  kind: TokenKind;
  value: string;
  pos: number;
}

// ── AST node types ───────────────────────────────────────────────────

export type ASTNode =
  | { type: "number"; value: number }
  | { type: "variable"; name: string }
  | { type: "unary"; op: string; operand: ASTNode }
  | { type: "binary"; op: string; left: ASTNode; right: ASTNode }
  | { type: "call"; name: string; args: ASTNode[] };

// ── Known constants ──────────────────────────────────────────────────

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

// ── Known functions (arity 1) ────────────────────────────────────────

const FUNCTIONS: Record<string, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  log: Math.log10,
  ln: Math.log,
  exp: Math.exp,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  sign: Math.sign,
};

// ── Tokenizer ────────────────────────────────────────────────────────

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i]!;

    // whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // number literal (including decimals like .5)
    if (/[0-9]/.test(ch) || (ch === "." && i + 1 < len && /[0-9]/.test(input[i + 1]!))) {
      const start = i;
      while (i < len && /[0-9]/.test(input[i]!)) i++;
      if (i < len && input[i] === ".") {
        i++;
        while (i < len && /[0-9]/.test(input[i]!)) i++;
      }
      tokens.push({ kind: "NUMBER", value: input.slice(start, i), pos: start });
      continue;
    }

    // identifier (function name, variable, constant)
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      while (i < len && /[a-zA-Z0-9_]/.test(input[i]!)) i++;
      tokens.push({ kind: "IDENT", value: input.slice(start, i), pos: start });
      continue;
    }

    // operators
    if ("+-*/^".includes(ch)) {
      tokens.push({ kind: "OP", value: ch, pos: i });
      i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ kind: "LPAREN", value: "(", pos: i });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "RPAREN", value: ")", pos: i });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ kind: "COMMA", value: ",", pos: i });
      i++;
      continue;
    }

    throw new ParseError(`Unexpected character '${ch}'`, i);
  }

  tokens.push({ kind: "EOF", value: "", pos: i });
  return tokens;
}

// ── Parse error ──────────────────────────────────────────────────────

export class ParseError extends Error {
  pos: number;
  constructor(message: string, pos: number) {
    super(message);
    this.name = "ParseError";
    this.pos = pos;
  }
}

// ── Parser ───────────────────────────────────────────────────────────
// Grammar (precedence low → high):
//   expr       = term (('+' | '-') term)*
//   term       = exponent (('*' | '/') exponent)*
//   exponent   = unary ('^' exponent)?          (right-associative)
//   unary      = ('-' | '+') unary | postfix
//   postfix    = primary                        (with implicit mul)
//   primary    = NUMBER | IDENT | IDENT '(' args ')' | '(' expr ')'
//
// Implicit multiplication: NUMBER IDENT, NUMBER '(', ')' '(', IDENT '('
// when IDENT is not a function, etc.

export function parse(input: string): ASTNode {
  const tokens = tokenize(input);
  let pos = 0;

  function peek(): Token {
    return tokens[pos]!;
  }

  function advance(): Token {
    const t = tokens[pos]!;
    pos++;
    return t;
  }

  function expect(kind: TokenKind, value?: string): Token {
    const t = peek();
    if (t.kind !== kind || (value !== undefined && t.value !== value)) {
      throw new ParseError(
        `Expected ${value ?? kind} but got '${t.value}'`,
        t.pos,
      );
    }
    return advance();
  }

  // ── Is this identifier a known function? ─────────────────────────
  function isFunction(name: string): boolean {
    return name in FUNCTIONS;
  }

  // ── expr: addition / subtraction ─────────────────────────────────
  function parseExpr(): ASTNode {
    let left = parseTerm();
    while (peek().kind === "OP" && (peek().value === "+" || peek().value === "-")) {
      const op = advance().value;
      const right = parseTerm();
      left = { type: "binary", op, left, right };
    }
    return left;
  }

  // ── term: multiplication / division ──────────────────────────────
  function parseTerm(): ASTNode {
    let left = parseExponent();
    for (;;) {
      const t = peek();
      // explicit * or /
      if (t.kind === "OP" && (t.value === "*" || t.value === "/")) {
        const op = advance().value;
        const right = parseExponent();
        left = { type: "binary", op, left, right };
        continue;
      }
      // implicit multiplication: 2x, 2(, x(, )(, 2sin, etc.
      if (
        t.kind === "NUMBER" ||
        t.kind === "LPAREN" ||
        (t.kind === "IDENT")
      ) {
        // only if the previous token makes sense for implicit mul
        const prev = tokens[pos - 1];
        if (
          prev &&
          (prev.kind === "NUMBER" ||
            prev.kind === "RPAREN" ||
            (prev.kind === "IDENT" && !isFunction(prev.value) && !(prev.value in CONSTANTS)))
        ) {
          const right = parseExponent();
          left = { type: "binary", op: "*", left, right };
          continue;
        }
      }
      break;
    }
    return left;
  }

  // ── exponent: right-associative ^ ────────────────────────────────
  function parseExponent(): ASTNode {
    const base = parseUnary();
    if (peek().kind === "OP" && peek().value === "^") {
      advance();
      const exp = parseExponent(); // right-associative recursion
      return { type: "binary", op: "^", left: base, right: exp };
    }
    return base;
  }

  // ── unary: prefix + / - ──────────────────────────────────────────
  function parseUnary(): ASTNode {
    const t = peek();
    if (t.kind === "OP" && (t.value === "-" || t.value === "+")) {
      const op = advance().value;
      const operand = parseUnary();
      if (op === "+") return operand;
      return { type: "unary", op: "-", operand };
    }
    return parsePrimary();
  }

  // ── primary: literals, variables, function calls, parens ─────────
  function parsePrimary(): ASTNode {
    const t = peek();

    // Number
    if (t.kind === "NUMBER") {
      advance();
      return { type: "number", value: parseFloat(t.value) };
    }

    // Identifier — could be constant, variable, or function call
    if (t.kind === "IDENT") {
      advance();
      const name = t.value;

      // function call
      if (peek().kind === "LPAREN" && isFunction(name)) {
        advance(); // consume (
        const args: ASTNode[] = [];
        if (peek().kind !== "RPAREN") {
          args.push(parseExpr());
          while (peek().kind === "COMMA") {
            advance();
            args.push(parseExpr());
          }
        }
        expect("RPAREN");
        return { type: "call", name, args };
      }

      // function without parens, e.g. "sin x" or "sin 2x"
      if (isFunction(name)) {
        const arg = parseUnary();
        return { type: "call", name, args: [arg] };
      }

      // constant
      if (name in CONSTANTS) {
        return { type: "number", value: CONSTANTS[name]! };
      }

      // variable
      return { type: "variable", name };
    }

    // Parenthesized expression
    if (t.kind === "LPAREN") {
      advance();
      const node = parseExpr();
      expect("RPAREN");
      return node;
    }

    throw new ParseError(`Unexpected token '${t.value}'`, t.pos);
  }

  const ast = parseExpr();
  if (peek().kind !== "EOF") {
    throw new ParseError(`Unexpected token '${peek().value}'`, peek().pos);
  }
  return ast;
}

// ── Evaluator ────────────────────────────────────────────────────────

export function evaluate(node: ASTNode, vars: Record<string, number>): number {
  switch (node.type) {
    case "number":
      return node.value;
    case "variable": {
      const v = vars[node.name];
      if (v === undefined) throw new Error(`Undefined variable '${node.name}'`);
      return v;
    }
    case "unary":
      return -evaluate(node.operand, vars);
    case "binary": {
      const l = evaluate(node.left, vars);
      const r = evaluate(node.right, vars);
      switch (node.op) {
        case "+": return l + r;
        case "-": return l - r;
        case "*": return l * r;
        case "/": return l / r;
        case "^": return Math.pow(l, r);
        default: throw new Error(`Unknown operator '${node.op}'`);
      }
    }
    case "call": {
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new Error(`Unknown function '${node.name}'`);
      const arg = evaluate(node.args[0]!, vars);
      return fn(arg);
    }
  }
}

// ── Convenience: compile string → (x: number) => number ─────────────

export interface CompiledFn {
  ast: ASTNode;
  fn: (x: number) => number;
}

export function compile(expr: string): CompiledFn {
  const ast = parse(expr);
  return {
    ast,
    fn: (x: number) => evaluate(ast, { x }),
  };
}

// ── Numerical derivative ─────────────────────────────────────────────

export function numericalDerivative(
  fn: (x: number) => number,
  x: number,
  h = 1e-7,
): number {
  return (fn(x + h) - fn(x - h)) / (2 * h);
}

// ── Find intersections between two functions on an interval ──────────

export function findIntersections(
  f: (x: number) => number,
  g: (x: number) => number,
  xMin: number,
  xMax: number,
  steps = 500,
): Array<{ x: number; y: number }> {
  const results: Array<{ x: number; y: number }> = [];
  const dx = (xMax - xMin) / steps;

  let prevDiff = f(xMin) - g(xMin);

  for (let i = 1; i <= steps; i++) {
    const x = xMin + i * dx;
    const fy = f(x);
    const gy = g(x);
    const diff = fy - gy;

    // sign change → bisect to find crossing
    if (!isNaN(prevDiff) && !isNaN(diff) && isFinite(prevDiff) && isFinite(diff)) {
      if (prevDiff * diff < 0) {
        let lo = x - dx;
        let hi = x;
        for (let j = 0; j < 50; j++) {
          const mid = (lo + hi) / 2;
          const midDiff = f(mid) - g(mid);
          if (isNaN(midDiff) || !isFinite(midDiff)) break;
          if ((f(lo) - g(lo)) * midDiff < 0) {
            hi = mid;
          } else {
            lo = mid;
          }
        }
        const ix = (lo + hi) / 2;
        const iy = f(ix);
        if (isFinite(iy)) {
          results.push({ x: ix, y: iy });
        }
      }
    }

    prevDiff = diff;
  }

  return results;
}
