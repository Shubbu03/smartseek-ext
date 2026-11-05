import { useEffect, useState } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { useCurrentVideo } from "../hooks/useCurrentVideo";
import { formatTime } from "../utils/videoUtils";

export default function CurrentVideo() {
  const { status, loading, saving, error, save, reload } = useCurrentVideo();
  const [showFeedback, setShowFeedback] = useState(false);
  const failed = !!error || status?.state === "error";
  const saved = showFeedback && status?.state === "saved";
  const canSave = !!status?.supported && status.canSave && !saving && !loading;
  const label = saving ? "Saving progress" : failed ? "Retry saving progress" : "Save progress";

  useEffect(() => {
    if (!showFeedback || saving) return;
    const timer = setTimeout(() => setShowFeedback(false), 2000);
    return () => clearTimeout(timer);
  }, [showFeedback, saving]);

  return <>
    {status?.supported ? <button className={`icon-button current-save${status.selected ? " is-saved" : ""}`} disabled={!canSave}
      onClick={() => { setShowFeedback(true); void save(); }} aria-label={label}
      title={`${label}${status.title ? `: ${status.title}` : ""}`}>
      {saving ? <CircleNotchIcon className="spin" aria-hidden="true" /> : failed ? <WarningCircleIcon aria-hidden="true" /> : saved ? <CheckCircleIcon aria-hidden="true" /> : <BookmarkSimpleIcon weight={status.selected ? "fill" : "regular"} aria-hidden="true" />}
    </button> : error && !loading ? <button className="icon-button" onClick={() => { void reload(); }} aria-label="Check the current video again" title="Try again"><ArrowClockwiseIcon aria-hidden="true" /></button> : null}
    {(failed || saving || saved) && <section className={`current-video${failed ? " current-video-error" : ""}`} aria-label="Current YouTube video" aria-busy={saving}>
      <div className={`current-video-status${failed ? " error-copy" : ""}`} role={failed ? "alert" : "status"}>
        {saving ? <CircleNotchIcon className="spin" aria-hidden="true" /> : failed ? <WarningCircleIcon aria-hidden="true" /> : <CheckCircleIcon aria-hidden="true" />}
        <span>{saving ? "Saving your place…" : error || status?.message}</span>
      </div>
      {status?.position !== null && status?.position !== undefined && failed && <p className="last-saved">Last saved at {formatTime(status.position)}</p>}
    </section>}
  </>;
}
