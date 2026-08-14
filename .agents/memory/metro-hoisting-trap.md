---
name: Metro hoisting trap
description: Metro/Babel rewrites JS function declarations to var assignments — define helpers BEFORE the component that uses them during render, not after.
---

## Rule
Never define a module-level helper function AFTER the component that calls it during render. Always place such helpers BEFORE the component in the file.

## Why
JavaScript `function` declarations are hoisted at the language level, but Metro's Babel pipeline (`@babel/plugin-transform-modules-commonjs` and related plugins) can rewrite `function foo() {}` to `var foo = function() {}`. A `var` declaration is hoisted as `undefined`; the assignment only happens when execution reaches that line. If the component body calls `foo()` before the assignment line is reached in the module execution order, `foo` is `undefined` and you get **"TypeError: undefined is not a function"** during render.

## How to apply
- Put standalone style-factory functions (e.g. `function localStyles(colors)`) BEFORE `export function ComponentName`.
- The crash pattern: "undefined is not a function" inside `renderWithHooks → updateFunctionComponent`, triggered during re-renders, no obvious null value in JSX.
- Confirmed on `DocumentRegisterSection`: `localStyles` was at line 1120, called at line 378; moving it before the component fixed it after multiple other attempts (useRef for deps, named import, empty dep arrays) all failed.
