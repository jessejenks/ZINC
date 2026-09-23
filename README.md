# The ZINC Abstract Machine

This project explores lambda calculus evaluation strategies, stack machines, and WebAssembly, based on the descriptions
of machines from chapter 3 of *The ZINC Experiment*[^1] by Xavier Leroy, which serves as a foundation for the OCaml
compiler, even to this day.

I attempted to implement these by following the paper directly, and not trying to find any existing code to use as
reference. As far as I know, there aren't really any resource which steps through the execution of these machines at
the level of detail I would have needed anyway. So this project also hopefully serves as reference for others.

## Motivation

This project is focused on understanding the ZINC (ZINC is Not CAML) abstract machine. Like the paper, I wanted to go
through the progression of complexity so that the final version doesn't feel so mysterious. Finally, I wanted to try and
build a version which targets WebAssembly.

### Progression

#### The Pure $\lambda$-calculus

Following the paper, the simplest version is [Krivine's machine](./src/pure/krivine.ts). This is a stack machine that
implements a call-by-name evaluation strategy, and can handle partial applications well. It's a very simple model,
with only 3 instructions, which makes it very easy to reason about.

Next is a variation of the Krivine machine, what Leroy calls
"[Krivine's machine with marks on the stack](./src/pure/marked-krivine.ts)". This version allows you to "mark" a
closure for strict evaluation, implementing a call-by-value evaluation strategy.

Finally, the [ZINC](./src/pure/zinc.ts) machine extends this idea[^2]. There are a number of
improvements, but for the pure lambda calculus, the main benefit is optimization of closure construction. Normally,
for both version of Krivine's machine, partial applications result in construction a closure for each argument. The
ZINC machine instead tries to build just one closure after capturing arguments.

#### $\lambda$-calculus with arithmetic

Since [the ZINC machine also handles primitive operations](./src/arith/zinc.ts) I created a second version where the
syntax includes unit and integer literals, and basic arithmetic (addition, subtraction, and multiplication). This
version of the machine has new instruction types. But they have been added in such a way that comparison with the pure
version is simple.

## WebAssembly

A secondary motivation for this project was learning WebAssembly (WASM) at a deeper level. So there is also a simple
[WASM library](./src/utils/wasm/) and a version of the [ZINC machine targeting WASM](./src/arith/zinc-wasm.ts).

It was an interesting challenge to try and map the ZINC machine onto the WASM execution model. While they are both stack
machines, it wasn't always obvious how to translate the ZINC instructions into WASM ones. In the end, I think I was able
to come up with a straightforward solution, and you can still see the progression nicely.

## Differences from the paper

In the interest of keeping the comparison across machines clear, there are a few differences from the machines described
in the paper.

In principle, with Krivine's machine with marks, you could have every application declare whether it should be strictly
evaluated or not. However, that would have required creating yet another variant of the syntax. So my implementation
just has a global switch making every application strict or lazy.

The ZINC paper does not explicitly describe how Krivine's machines could be modified to handle primitive operations,
but from my attempts, it requires breaking some of the nice features of the original compilation process, and adds
some extra cases to execution. So I didn't include them since the comparison wouldn't be very valuable.

One optimization the ZINC machine uses is special handling for let expressions. I did not implement this, since it adds
even more instructions and further obscured the comparison to Krivine's machines. However, in the arithmetic version,
the surface syntax does allow writing let expressions, they just get elaborated to plain lambdas.

The environment is represented as a linked list (cons/nil), rather than the more optimized flat environment
representation discussed in section 3.4 of the paper. This is potential future work for WASM compilation.

## Building

First install (dev) dependencies

```sh
npm install
# or
npm ci
```

Note that even with `npm ci`, if you are using npm 11 or higher, there may be installation issues with `tslib` because
this is marked as an optional peer dependency, but it's required for the rollup typescript plugin.

To build the library

```sh
npm run build
```

This will build three versions, web (iife), ESM, and CommonJS, and type declaration files.

Note that you will need node 24.x or higher, or run in a modern browser to use the WebAssembly compiler, because it
relies on the GC extension.

### Examples

Examples are available in the examples directory. These can be built and run separately.

```sh
npm run build:examples
node dist/examples/arith/zinc-wasm.cjs
```

### Tests

Running tests

```sh
npm run test
```

---

[^1]: Xavier Leroy. *The ZINC experiment: an economical implementation of the ML language.* Technical Report RT-0117,
INRIA, February 1990. https://inria.hal.science/inria-00070049
[^2]: Leroy says the initial implementation design came first, but this framing of comparison to Krivine's machines is
helpful for understanding.
