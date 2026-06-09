---
name: new-route
description: Scaffold a new Express v5 API route following ServerDock's exact patterns — async handler, optional JWT middleware, standard error responses. Use whenever adding a new endpoint.
---

You are scaffolding a new Express v5 API route for the ServerDock backend. Follow these rules exactly.

## Step 1 — Gather info

If the user did not provide all of the following, ask before writing any code:
- HTTP method (GET, POST, PUT, DELETE)
- Path (e.g. `/api/servers/:id/start`)
- Auth required? (yes = JWT protected, no = public)
- What it does (one sentence)

## Step 2 — Scaffold the route

Use this exact structure:

### Public route (no auth)
```js
router.get('/path', async (req, res) => {
  // logic here
  res.json({ ... });
});
```

### Protected route (JWT required)
```js
router.post('/path', verifyToken, async (req, res) => {
  // logic here
  res.status(201).json({ ... });
});
```

## Rules

**Express v5 async:** Do NOT wrap in try/catch. Express v5 automatically forwards thrown errors to the error middleware. Just throw or let the error propagate.

**Error responses always use this shape:**
```js
res.status(400).json({ error: 'Human-readable message' });
```

**Status codes per spec:**
- 200 — success
- 201 — created
- 400 — bad request (missing/invalid fields, unconfirmed reset)
- 401 — unauthorized (missing or invalid JWT — handled by verifyToken middleware, not manually)
- 404 — resource not found
- 409 — conflict (already running, ID taken, must stop first)
- 503 — Docker unavailable

**verifyToken** is imported from `../middleware/auth.js` (or wherever it lives in the project).

**Response chaining:** Always chain status and json: `res.status(code).json(obj)` — never `res.json(obj, status)` (Express v5 removed that).

## Step 3 — Place the code

Ask the user which router file to add it to (or suggest the correct one based on the path prefix). Show the final snippet ready to paste, with the import line if a new import is needed.
