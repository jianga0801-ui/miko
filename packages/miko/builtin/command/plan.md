---
description: Research and produce a saved implementation plan
---

Load the `plan-protocol` skill first, then coordinate research with `explore` (internal codebase) and `researcher` (external docs/APIs) to produce a comprehensive implementation plan.

Load relevant additional skills before finalizing:
- Backend/logic work → `skill` load `code-philosophy`
- UI/frontend work → `skill` load `frontend-philosophy`

Use `plan_save` to save the plan in this format:

```markdown
---
status: in-progress
phase: 2
updated: YYYY-MM-DD
---

# Implementation Plan

## Goal
[One sentence describing the outcome]

## Context & Decisions
| Decision | Rationale | Source |
|----------|-----------|--------|
| [choice] | [why] | `ref:delegation-id` |

## Phase 1: [Name] [COMPLETE]
- [x] 1.1 Task description
- [x] 1.2 Another task → `ref:delegation-id`

## Phase 2: [Name] [IN PROGRESS]
- [x] 2.1 Completed task
- [ ] **2.2 Current task** ← CURRENT
- [ ] 2.3 Pending task
```

Rules:
1. **One CURRENT task** - Only one task may have ← CURRENT
2. **Cite decisions** - Use `ref:delegation-id` for research-informed choices
3. **Auto-save after approval** - When user approves the plan, immediately call `plan_save`

Saving the plan is a REQUIREMENT. The user cannot see the plan unless it is saved.

**Task:** $ARGUMENTS
