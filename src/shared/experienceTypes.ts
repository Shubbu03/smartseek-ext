import { isRecord } from "./validation";

export type Experience = { step: "welcome" | "upgrade" | "ready" };
export function isExperience(value: unknown): value is Experience {
  return isRecord(value) && ["welcome", "upgrade", "ready"].includes(String(value.step));
}
