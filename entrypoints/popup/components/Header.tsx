import { FiSettings, FiArrowLeft } from "react-icons/fi";

type HeaderProps = {
  currentView: "home" | "settings";
  onViewChange: (view: "home" | "settings") => void;
};

export default function Header({ currentView, onViewChange }: HeaderProps) {
  return (
    <div className="bg-[#2d3133] text-[#f4f2ee] p-3 shadow-md">
      <div className="flex items-center relative">
        {currentView === "settings" ? (
          <button
            onClick={() => onViewChange("home")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity absolute left-0"
            aria-label="Back to home"
          >
            <FiArrowLeft size={20} />
            <span className="text-sm font-medium">Back</span>
          </button>
        ) : null}
        <h1 className="text-xl font-bold flex-1 text-center">
          {currentView === "settings" ? "Settings" : "smartseek"}
        </h1>
        {currentView === "home" ? (
          <button
            onClick={() => onViewChange("settings")}
            className="p-1.5 hover:bg-[#3e4244] rounded-full transition-colors cursor-pointer absolute right-0"
            aria-label="Open settings"
            title="settings"
          >
            <FiSettings size={20} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

