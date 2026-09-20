"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ComboboxOption = { value: string; label: string; description?: string };

type ComboboxProps = {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  // Label to show for `value` when it isn't (or isn't yet) in `options`.
  selectedLabel?: string;
  // Async mode: the parent supplies already-filtered options for each query.
  onQueryChange?: (query: string) => void;
  loading?: boolean;
};

export function Combobox({
  options,
  value,
  onValueChange,
  id,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results.",
  selectedLabel,
  onQueryChange,
  loading = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const visible =
    onQueryChange || !needle
      ? options
      : options.filter((option) => option.label.toLowerCase().includes(needle));

  const currentLabel = options.find((option) => option.value === value)?.label ?? selectedLabel;

  function select(next: string) {
    onValueChange(next);
    setOpen(false);
    setQuery("");
    onQueryChange?.("");
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    onQueryChange?.(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !currentLabel && "text-muted-foreground")}>
            {currentLabel ?? placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-2">
        <Input
          autoFocus
          value={query}
          placeholder={searchPlaceholder}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (visible[0]) select(visible[0].value);
            }
          }}
        />
        <ul role="listbox" className="mt-2 max-h-60 overflow-y-auto">
          {visible.length === 0 ? (
            <li className="px-2 py-3 text-center text-sm text-muted-foreground">
              {loading ? "Searching..." : emptyText}
            </li>
          ) : (
            visible.map((option) => (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => select(option.value)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </div>
                  {option.value === value && <Check className="size-4 shrink-0" />}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
