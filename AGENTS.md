# AGENTS.md

Operational guidance for Codex / GPT-5.4-class agents working in this repository.

This file should be treated as the primary agent guide for this repo. `CLAUDE.md` contains useful history, but parts of it are stale. When they conflict, follow this file and the current code.

## Objective

Build and maintain a cross-platform terminal AI assistant with an Ink-based chat UI, provider-specific agent adapters, a permissioned tool system, and secure local configuration.

Make the smallest correct change that solves the task, preserve current behavior unless the task requires a change, and verify with the narrowest useful checks before broadening.

## Fast Start

Before editing:

1. Read `package.json`, the relevant source files, and any nearby tests.
2. Check whether the task touches UI flow, agent execution, provider wiring, tools, or secure storage.
3. Prefer targeted edits over broad cleanup or refactors.

After editing:

1. Review the diff.
2. Run the most relevant validation first.
3. Run broader checks only when the change surface justifies it.

## Repository Map

- `src/index.tsx`, `src/cli.js`: process entrypoints.
- `src/app.tsx`: top-level Ink app and main UI orchestration.
- `src/hooks/`: chat session, input controller, config, and agent lifecycle hooks.
- `src/components/`: Ink UI components and overlays.
- `src/agent/`: executor, context management, prompt building, compaction, provider adapters.
- `src/tools/`: tool definitions, registry, and permissions.
- `src/commands/`: slash commands and palette behavior.
- `src/lib/`: providers, storage, platform, markdown, clipboard, utilities.
- `src/__tests__`, `src/**/__tests__`: unit and integration coverage.
- `dist/`: build output. Do not hand-edit.

## Current Technical Reality

Do not rely on `README.md` or `CLAUDE.md` alone for feature truth. Verify behavior in code.

Known examples:

- The app discovers both `AGENTS.md` and `CLAUDE.md` via `src/agent/instructions.ts`.
- `src/app.tsx` explicitly uses a single input-controller pattern. Do not introduce additional `useInput` handling in child components unless the architecture is intentionally being changed.
- Imports are ESM/NodeNext and use `.js` specifiers from TypeScript source. Preserve that style.
- TypeScript is strict and uses `noUncheckedIndexedAccess`.
- OpenAI appears in config and docs, but `src/agent/create-executor.ts` currently throws for the OpenAI agentic provider. Do not assume provider parity without checking the implementation.

## Working Rules

- Keep changes surgical. Avoid opportunistic renames, wide formatting churn, or unrelated cleanup.
- Preserve cross-platform behavior. Anything involving shell commands, paths, clipboard access, or process execution must be checked for Windows, macOS, and Linux impact.
- Respect the security model. Tool permissions, secure storage, and command execution defaults are sensitive areas.
- Preserve UX flow in Ink. Keyboard handling, overlays, focus state, and streaming output are easy to regress.
- Update tests when behavior changes or when adding logic in already-tested areas.
- If a user request conflicts with current architecture, prefer adapting within the architecture over rewriting it.

## Change Guidelines By Area

### Ink UI and input flow

- Start from `src/app.tsx` and the relevant hook/component pair.
- Keep the chat-first flow intact.
- Avoid adding duplicate state ownership across `app.tsx`, hooks, and presentation components.
- Be careful with keyboard navigation, palette visibility, config/help overlays, and pending-permission UX.

### Agent execution and providers

- Keep provider, adapter, tool-registry, and executor behavior aligned.
- If changing message formats or prompt assembly, inspect tests in `src/agent/__tests__` and adapter tests in `src/agent/adapters/__tests__`.
- Preserve abort behavior, permission prompts, and event sequencing.

### Tools and permissions

- Treat `src/tools/permissions.ts` and `src/tools/builtin/*` as security-sensitive.
- Prefer explicit validation and predictable failure modes.
- Do not weaken permission defaults casually.
- File and shell tools must remain path-conscious and cross-platform.

### Storage and config

- API keys and config handling live in secure storage logic; avoid introducing plaintext secrets or bypasses.
- Keep first-run and missing-key flows working.

## Validation

Use the smallest check that can actually fail for the code you changed.

Common commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Guidance:

- For type-only or logic-only changes, start with `pnpm typecheck`.
- For lint-sensitive edits, run `pnpm lint`.
- For behavioral changes with existing tests, run the relevant Vitest coverage first, then `pnpm test` if needed.
- For entrypoint, packaging, or emitted-output changes, run `pnpm build`.
- Avoid running `pnpm format` across the repo unless the task is explicitly formatting-focused.

## Scripts

- Use `node scripts/version.js <version>` to update both `package.json` and `src/constants.ts`.
- Use `node scripts/tag.js` after the release commit to create the matching git tag.
- Prefer repo scripts over manual edits for release/version workflows.

## Testing Expectations

- Add or update tests near the changed code when practical.
- Prefer existing test patterns in `src/**/__tests__`.
- If you skip tests, state the reason clearly in your final response.

## Editing Conventions

- Keep files in ASCII unless the file already requires otherwise.
- Follow existing naming and import style.
- Keep comments sparse and useful.
- Do not manually edit generated output under `dist/`.
- Do not change package versions, release scripts, or tags unless the task is explicitly about release management.

## Good Defaults For Codex

- Read only the files needed to make the next correct decision.
- Prefer concrete evidence from code over documentation claims.
- Check for nearby tests before inventing new patterns.
- Summarize assumptions when they matter.
- Leave the repo cleaner only where it directly supports the requested change.
