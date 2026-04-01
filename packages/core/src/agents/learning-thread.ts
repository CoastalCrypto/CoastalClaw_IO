// packages/core/src/agents/learning-thread.ts
import type { LoopResult } from './types.js'
import type { SkillGapsLog } from './skill-gaps.js'

/** Called after AgenticLoop completes. Runs asynchronously — never blocks the response. */
export async function runBackgroundReview(
  result: LoopResult,
  sessionId: string,
  skillGaps: SkillGapsLog,
): Promise<void> {
  for (const action of result.actions) {
    const isFailure =
      action.output.startsWith('Error:') ||
      action.output.startsWith('Execution error:') ||
      action.decision === 'block' ||
      action.decision === 'timeout'

    if (isFailure) {
      skillGaps.record({
        sessionId,
        agentId: result.domain,
        toolName: action.tool,
        failurePattern: action.output,
        args: action.args,
        timestamp: Date.now(),
      })
    }
  }
}
