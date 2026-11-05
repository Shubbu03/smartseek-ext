import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { isSortOption, SORT_LABELS } from "../types";
import type { SortOption } from "../types";

type SearchBarProps = { searchTerm: string; sortOrder: SortOption; onSearchChange: (term: string) => void; onSortChange: (order: SortOption) => void };

export default function SearchBar({ searchTerm, sortOrder, onSearchChange, onSortChange }: SearchBarProps) {
  return (
    <div className="library-toolbar" id="library-search">
      <div className="search-field">
        <MagnifyingGlassIcon aria-hidden="true" />
        <input type="search" aria-label="Search saved videos" placeholder="Search your videos" autoFocus value={searchTerm} onChange={(event) => onSearchChange(event.target.value)} />
        {searchTerm && <button className="search-clear" aria-label="Clear search" onClick={() => onSearchChange("")}><XIcon aria-hidden="true" /></button>}
      </div>
      <label className="sort-picker">
        <span>Sort by</span>
        <select aria-label="Sort saved videos" value={sortOrder} onChange={(event) => { if (isSortOption(event.target.value)) onSortChange(event.target.value); }}>
          {Object.entries(SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <CaretDownIcon aria-hidden="true" />
      </label>
    </div>
  );
}
