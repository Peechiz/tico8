# tico8

A Pico-8-inspired fantasy console. `01-spec.md` says what it is;
`plan/README.md` lists the slices that build it, in order.

Every slice is a **tracer bullet**: a thin path through engine, dev tool and
example game that ends with something visible in `examples/demo` and a Vitest
test that checks the pixel buffer.

## Working a slice

1. **Pick.** The slice the user names; otherwise the first `todo` row in
   `plan/README.md` whose "needs" are all `done`. Set its row to `doing`.
2. **Detail it if it is a stub.** A stub has a "Task areas" list instead of
   task checkboxes. Settle its "Decide first" items with the user, write the
   answers into `01-spec.md`, then write tasks in the form used by
   `plan/01-skeleton.md`. Done when every task names the files it owns and the
   tasks it waits on, and no two tasks own the same file.
3. **Contract first.** Do the task marked *contract* alone: it fixes the
   exported types the other tasks build against.
4. **Fan out.** Give each remaining task whose waits are ticked to its own
   subagent, in parallel. A task is done when its test passes and its box is
   ticked in the slice file.
5. **Close.** Run `pnpm check` to format and fix. The slice is done when
   every box is ticked, every command under "Check" passes, and the "Demo"
   has been seen running in the browser. Then move its "Decisions made" into
   `01-spec.md` and set its row to `done`.

## Who edits what

- A subagent edits the files its task owns, plus its own checkbox and the
  "Decisions made" section of its slice file.
- The lead session edits `plan/README.md`, `01-spec.md` and the wiring between
  tasks.
- A task that needs a change in a file another task owns reports it to the
  lead and waits.

## When the spec is silent

Ask the user, then record the answer under "Decisions made" in the slice file.
Function names in `01-spec.md` are illustrative; the contract task of each
slice fixes the real ones.
