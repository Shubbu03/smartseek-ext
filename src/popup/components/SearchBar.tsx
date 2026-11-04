import { FiSearch, FiSliders, FiX } from "react-icons/fi";
import { isSortOption, SORT_LABELS } from "../types";
import type { SortOption } from "../types";

type SearchBarProps = { searchTerm: string; sortOrder: SortOption; onSearchChange: (term: string) => void; onSortChange: (order: SortOption) => void };

export default function SearchBar({ searchTerm, sortOrder, onSearchChange, onSortChange }: SearchBarProps) {
  return (
    <div className="library-toolbar">
      <div className="search-field">
        <FiSearch aria-hidden="true" />
        <input type="search" aria-label="Search saved videos" placeholder="Search your videos" value={searchTerm} onChange={(event) => onSearchChange(event.target.value)} />
        {searchTerm && <button className="search-clear" aria-label="Clear search" onClick={() => onSearchChange("")}><FiX aria-hidden="true" /></button>}
      </div>
      <label className="sort-picker" title={`Sort: ${SORT_LABELS[sortOrder]}`}>
        <FiSliders aria-hidden="true" />
        <select aria-label="Sort saved videos" value={sortOrder} onChange={(event) => { if (isSortOption(event.target.value)) onSortChange(event.target.value); }}>
          {Object.entries(SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
  );
}
