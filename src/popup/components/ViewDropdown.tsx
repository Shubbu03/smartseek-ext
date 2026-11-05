import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { isViewType, VIEW_LABELS } from "../types";
import type { VideoViewType } from "../types";

type ViewDropdownProps = { viewType: VideoViewType; counts: Record<VideoViewType, number>; onViewChange: (view: VideoViewType) => void };

export default function ViewDropdown({ viewType, counts, onViewChange }: ViewDropdownProps) {
  return (
    <div className="library-view">
      <h1>{VIEW_LABELS[viewType]} <span className="view-count">({counts[viewType]})</span><CaretDownIcon aria-hidden="true" /></h1>
      <select aria-label="Library view" value={viewType} onChange={(event) => { if (isViewType(event.target.value)) onViewChange(event.target.value); }}>
        {(["recent", "favourites", "selected", "music", "completed"] as const).map((view) => <option key={view} value={view}>{VIEW_LABELS[view]} ({counts[view]})</option>)}
      </select>
    </div>
  );
}
