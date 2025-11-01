import React, { useState, useRef, useEffect } from "react";
import { FiChevronDown } from "react-icons/fi";
import { VideoViewType } from "../types";

interface ViewDropdownProps {
    viewType: VideoViewType;
    onViewChange: (view: VideoViewType) => void;
}

const ViewDropdown: React.FC<ViewDropdownProps> = ({ viewType, onViewChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const options: { value: VideoViewType; label: string }[] = [
        { value: "recent", label: "Recent Saves" },
        { value: "music", label: "Music Videos" },
    ];

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
                aria-label="Change view type"
            >
                <span>{options.find((opt) => opt.value === viewType)?.label || "Recent Saves"}</span>
                <FiChevronDown size={14} className={isOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[160px]">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => {
                                onViewChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${viewType === option.value
                                ? "bg-[#2d3133] text-[#f4f2ee]"
                                : "text-[#2d3133] hover:bg-gray-100"
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ViewDropdown;

