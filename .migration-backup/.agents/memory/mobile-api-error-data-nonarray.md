---
name: Mobile api.request returns error body as data on non-ok
description: On non-2xx JSON responses the mobile api client sets data to the error object, so `res.data || fallback` keeps a non-array and .map/.length crash
---

# Mobile api client puts the error body into `data` on non-ok responses

`mobile/src/lib/api.ts` `request()` (and `get/post/...` that delegate to it):
on a non-ok JSON response it returns `{ error, data: errorData }` where
`errorData` is the parsed error body (e.g. `{ error: 'Not a member...' }`).

**Why this bites:** callers that do `setX(res.data || [])` then `x.map(...)`
get the error OBJECT, not an array. `{error}.length` is `undefined` (so an
`=== 0` empty-guard silently passes) and `{error}.map` is `undefined` → render
crash "X.map is not a function (it is undefined)". A 403/400/500 (e.g. the
subbie isn't a member of that business) is enough to trigger it.

**How to apply:** for any list endpoint, never trust `res.data` is the expected
shape on error. Guard with `Array.isArray(res.data) ? res.data : []` (or check
`res.error` first), not `res.data || []`; same for nested arrays
(`Array.isArray(res.data?.foo) ? ...`). Do NOT "fix" this by removing the
error-body-as-data behaviour in the api client — other callers read that error
body for messages; always fix at the call site.
