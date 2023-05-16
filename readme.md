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

You can replace your typical barrel export file with a one-liner:

```javascript
// ./utils/index.js
export * from 'glob:./!(index).js';

/*
Instead of:

export * from './foo.js';
export * from './bar.js';
export * from './baz.js';
// ... and all the other files inside `utils/`
*/
```

