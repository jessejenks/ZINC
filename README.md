# Stack Machines

This project explores lambda calculus evaluation strategies and stack machines.

Based on descriptions of machines in *The ZINC Experiment*[^1] by Xavier Leroy.

## Building

To build the library

```sh
npm run build
```

This will build three versions, web (iife), ESM, and CommonJS, and type declaration files.

### Examples

Examples are available in the examples directory. These can be built and run separately.

```sh
npm run build:examples
node dist/examples/pure/reduce.cjs
node dist/examples/pure/krivine.cjs
```

### Tests

Running tests

```sh
npm run test
```

---

[^1]: Xavier Leroy. *The ZINC experiment: an economical implementation of the ML language.* Technical Report RT-0117, INRIA, February 1990. https://inria.hal.science/inria-00070049