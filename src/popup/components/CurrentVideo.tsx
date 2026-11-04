import { FiAlertCircle, FiBookmark, FiCheckCircle, FiLoader, FiMonitor, FiRefreshCw } from "react-icons/fi";
import { useCurrentVideo } from "../hooks/useCurrentVideo";
import { formatTime } from "../utils/videoUtils";

export default function CurrentVideo() {
  const { status, loading, saving, error, save, reload } = useCurrentVideo();
  const failed = !!error || status?.state === "error";
  const waiting = loading || status?.state === "waiting";
  const message = saving ? "Saving your place…" : error || status?.message || "Open a YouTube watch page to save your place.";
  const canSave = !!status?.supported && status.canSave && !saving && !loading;

  return (
    <section className={`current-video${failed ? " current-video-error" : ""}`} aria-label="Current YouTube video" aria-busy={loading || saving}>
      <p className="overline">Current YouTube video</p>
      <p className="current-video-title" title={status?.title || undefined}>{loading ? "Checking your current tab…" : status?.title || "A good place to pause."}</p>
      <div className={`current-video-status${failed ? " error-copy" : ""}`} role={failed ? "alert" : "status"}>
        {saving || loading ? <FiLoader className="spin" aria-hidden="true" /> : failed ? <FiAlertCircle aria-hidden="true" /> : status?.state === "saved" ? <FiCheckCircle aria-hidden="true" /> : <FiMonitor aria-hidden="true" />}
        <span>{message}</span>
      </div>
      {status?.position !== null && status?.position !== undefined && failed && <p className="last-saved">Last saved at {formatTime(status.position)}</p>}
      {status?.supported ? (
        <button className="icon-button current-save" disabled={!canSave} onClick={() => { void save(); }}
          aria-label={saving ? "Saving progress" : failed ? "Retry saving this video" : status.selected ? "Save progress now" : "Save this video"}
          title={saving ? "Saving…" : failed ? "Retry save" : status.selected ? "Save progress now" : "Save this video"}>
          {saving ? <FiLoader className="spin" aria-hidden="true" /> : status.selected ? <FiCheckCircle aria-hidden="true" /> : <FiBookmark aria-hidden="true" />}
        </button>
      ) : error && !waiting ? <button className="icon-button current-save" onClick={() => { void reload(); }} aria-label="Check the current video again" title="Try again"><FiRefreshCw aria-hidden="true" /></button> : null}
    </section>
  );
}
