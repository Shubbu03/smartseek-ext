import { useEffect } from "react";
import type { Settings } from "@/settings/types";

export function useAppearance(settings: Settings | null) {
  const theme = settings?.theme ?? "system";
  const density = settings?.density ?? "comfortable";
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
  }, [theme, density]);
}
