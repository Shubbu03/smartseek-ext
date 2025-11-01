import { SortOption } from "../types";

type SearchBarProps = {
  searchTerm: string;
  sortOrder: SortOption;
  onSearchChange: (term: string) => void;
  onSortChange: (order: SortOption) => void;
};

const SortButton: React.FC<{
  value: SortOption;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ value, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
      isActive
        ? "bg-[#2d3133] text-[#f4f2ee]"
        : "bg-gray-200 text-[#2d3133] hover:bg-gray-300"
    }`}
  >
    {label}
  </button>
);

export default function SearchBar({
  searchTerm,
  sortOrder,
  onSearchChange,
  onSortChange,
}: SearchBarProps) {
  return (
    <div className="p-4 border-b border-gray-300">
      <input
        type="text"
        placeholder="Search videos..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full px-3 py-2 mb-3 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2d3133] focus:border-[#2d3133] outline-none"
        autoFocus
      />
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-medium text-[#313536] mr-1">
          Sort by:
        </span>
        <SortButton
          value="default"
          label="Default"
          isActive={sortOrder === "default"}
          onClick={() => onSortChange("default")}
        />
        <SortButton
          value="titleAsc"
          label="Title A-Z"
          isActive={sortOrder === "titleAsc"}
          onClick={() => onSortChange("titleAsc")}
        />
        <SortButton
          value="titleDesc"
          label="Title Z-A"
          isActive={sortOrder === "titleDesc"}
          onClick={() => onSortChange("titleDesc")}
        />
        <SortButton
          value="progressDesc"
          label="Most Watched"
          isActive={sortOrder === "progressDesc"}
          onClick={() => onSortChange("progressDesc")}
        />
        <SortButton
          value="progressAsc"
          label="Least Watched"
          isActive={sortOrder === "progressAsc"}
          onClick={() => onSortChange("progressAsc")}
        />
      </div>
    </div>
  );
}

