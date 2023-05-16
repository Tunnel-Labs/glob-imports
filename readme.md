# glob-imports

Support for glob-based file imports in JavaScript/TypeScript.

Given the following file structure:

```text
.
└── utils/
    ├── index.js
    ├── foo.js
    ├── bar.js
    └── baz.js
```

Before:

```
// ./utils/index.js
export * from './foo.js';
export * from './bar.js';
export * from './baz.js';
// ... and all the other files inside `utils/`
```

After:

```javascript
// ./utils/index.js
export * from 'glob:./!(index).js';
```

## TypeScript

`glob-imports` also comes with support for TypeScript, but requires a few steps to set up:

<!-- TODO -->
