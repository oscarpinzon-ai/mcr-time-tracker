import { useEffect, useRef, useState } from "react";

interface FilterOption {
  id: string;
  label: string;
}

interface ReportFiltersProps {
  filters: { techs: string[]; jobTypes: string[] };
  setFilters: (f: { techs: string[]; jobTypes: string[] }) => void;
  techs: FilterOption[];
  jobTypes: FilterOption[];
}

export function ReportFilters({
  filters,
  setFilters,
  techs,
  jobTypes,
}: ReportFiltersProps) {
  const toggle = (arrKey: "techs" | "jobTypes", id: string) => {
    const cur = filters[arrKey];
    const next = cur.includes(id)
      ? cur.filter((x) => x !== id)
      : [...cur, id];
    setFilters({ ...filters, [arrKey]: next });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <FilterDropdown
        label="Technicians"
        count={filters.techs.length}
        options={techs}
        selected={filters.techs}
        onToggle={(id) => toggle("techs", id)}
        onClear={() => setFilters({ ...filters, techs: [] })}
      />
      <FilterDropdown
        label="Job types"
        count={filters.jobTypes.length}
        options={jobTypes}
        selected={filters.jobTypes}
        onToggle={(id) => toggle("jobTypes", id)}
        onClear={() => setFilters({ ...filters, jobTypes: [] })}
      />
    </div>
  );
}

interface FilterDropdownProps {
  label: string;
  count: number;
  options: FilterOption[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

function FilterDropdown({
  label,
  count,
  options,
  selected,
  onToggle,
  onClear,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 border-2 border-neutral-300 text-[11px] uppercase tracking-wider font-bold hover:border-black bg-white"
      >
        {label}
        {count > 0 && (
          <span className="inline-flex items-center justify-center bg-black text-white text-[10px] px-1.5 py-0.5">
            {count}
          </span>
        )}
        <span className="text-neutral-500">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border-2 border-black shadow-lg overflow-hidden z-30 min-w-[220px]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200 text-[10px] uppercase tracking-wider font-bold text-neutral-700">
            <span>{label}</span>
            {count > 0 && (
              <button
                onClick={onClear}
                className="underline hover:text-black"
              >
                Clear
              </button>
            )}
          </div>
          {options.map((o) => {
            const on = selected.includes(o.id);
            return (
              <button
                key={o.id}
                onClick={() => onToggle(o.id)}
                className="flex items-center gap-2 w-full px-3 py-2 text-left text-[12px] hover:bg-neutral-50"
              >
                <span
                  className="inline-block w-4 h-4 border-2 border-neutral-400 flex-shrink-0"
                  style={{
                    background: on ? "var(--util-mid)" : "white",
                    borderColor: on ? "oklch(0.20 0 0)" : undefined,
                  }}
                >
                  {on && (
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      style={{ width: "100%", height: "100%" }}
                    >
                      <path
                        d="M3 8l3 3 7-7"
                        stroke="black"
                        strokeWidth="2.5"
                        strokeLinecap="square"
                      />
                    </svg>
                  )}
                </span>
                <span className="flex-1">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
