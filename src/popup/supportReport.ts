import { requestLibrary } from "@/shared/libraryProtocol";
import { activePlayback } from "./playback";

export type IssueDetails = { doing: string; expected: string; happened: string };
export async function prepareSupportReport(issue: IssueDetails): Promise<string> {
  const [diagnostics, player] = await Promise.all([requestLibrary({ type: "diagnostics.get" }),
    activePlayback("status").then((status) => status ? { page: "watch", state: status.state, canSave: status.canSave } : { page: "unsupported" })
      .catch(() => ({ page: "unavailable" }))]);
  const browser = /(?:Chrome|Chromium)\/(\d+)/.exec(navigator.userAgent);
  return JSON.stringify({ ...diagnostics,
    browser: browser ? `Chromium ${browser[1]}` : "Unknown browser", player,
    issue: { doing: issue.doing.slice(0, 2000), expected: issue.expected.slice(0, 2000), happened: issue.happened.slice(0, 2000) },
  }, null, 2);
}
