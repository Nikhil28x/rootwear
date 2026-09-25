# Database tests

Run against a throwaway local Postgres 16 cluster — never against the Supabase
project. These prove the §18 launch-gate lines that concern the database.

## Running

```bash
./supabase/tests/run.sh
```

Requires `postgresql@16` on PATH (`brew install postgresql@16`). The script
creates a temporary cluster, applies every migration in order against a stubbed
`auth` schema, and runs the assertions below.

## What is proven

| Test | §18 launch-gate line |
|---|---|
| Two concurrent callers for the last piece | "Stock decrements correctly when the same last piece is bought in two tabs at once; the loser is refused cleanly." |
| Five concurrent callers across five sizes | Piece numbers stay unique per drop — the reason `reserve_piece` locks the **drop** row before the variant row. |
| Replayed `reserve_piece` | A redelivered webhook must not allocate a second piece. |
| Replayed `commit_order` | "A duplicate webhook does not create a second order." |
| `commit_order` price | "A price tampered with in the browser is rejected server-side" — the function takes no amount parameter at all. |
| Anon role against `app.*` | "Anonymous clients cannot read ... any customer record." |
| Anon role against an unpublished drop | An unreleased drop must not leak through the anon key. |
