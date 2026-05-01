<!--
.architect/queue.md — work items for the Coastal.AI Architect

Format:
  ## <Work Item Title>

  Optional fenced YAML config:
  ```yaml
  target_hints:
    - packages/core/src/some/file.ts
  budget_iters: 3
  approval_policy: plan-only      # full | plan-only | pr-only | none
  ```

  Free-text body — describe why this matters and any hints for the architect.

After a work item is opened as a PR, the architect rewrites its block
to: `## <Title>\n<!-- moved to PR #N -->`

Add new entries below this comment.
-->
