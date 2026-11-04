import { FiChevronDown } from "react-icons/fi";
import { isViewType, VIEW_LABELS } from "../types";
import type { VideoViewType } from "../types";

type ViewDropdownProps = { viewType: VideoViewType; counts: Record<VideoViewType, number>; onViewChange: (view: VideoViewType) => void };

export default function ViewDropdown({ viewType, counts, onViewChange }: ViewDropdownProps) {
  const moreActive = viewType !== "recent" && viewType !== "favourites";
  return (
    <div className="library-views" role="group" aria-label="Library views">
      {(["recent", "favourites"] as const).map((view) => <button key={view} aria-pressed={viewType === view} onClick={() => onViewChange(view)}>
        {VIEW_LABELS[view]}<span className="view-count">{counts[view]}</span>
      </button>)}
      <label className={`more-views${moreActive ? " is-active" : ""}`}>
        <select aria-label="More library views" value={moreActive ? viewType : ""} onChange={(event) => { if (isViewType(event.target.value)) onViewChange(event.target.value); }}>
          <option value="" disabled>More</option>
          {(["selected", "music", "completed"] as const).map((view) => <option key={view} value={view}>{VIEW_LABELS[view]} ({counts[view]})</option>)}
        </select><FiChevronDown aria-hidden="true" />
      </label>
    </div>
  );
}
