"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  createContext,
  useContext,
} from "react";
import { Search, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TrackList } from "@/components/tracks/track-list";
import { useSceneAccent } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { Track } from "@atlas/shared";

// Shared state between SearchInput (in header) and SearchResults (in content area)
interface SearchState {
  query: string;
  results: Track[];
  isSearching: boolean;
  hasSearched: boolean;
  isActive: boolean;
  setQuery: (q: string) => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleClear: () => void;
}

const SearchContext = createContext<SearchState | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string) => {
    abortRef.current?.abort();

    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);

    try {
      const res = await fetch(
        `/api/tracks/search?q=${encodeURIComponent(q.trim())}&limit=20`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results ?? []);
      setHasSearched(true);
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("Search error:", err);
        setResults([]);
        setHasSearched(true);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQueryState(value);

      if (timerRef.current) clearTimeout(timerRef.current);

      if (!value.trim()) {
        setResults([]);
        setHasSearched(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      timerRef.current = setTimeout(() => doSearch(value), 300);
    },
    [doSearch]
  );

  const handleClear = useCallback(() => {
    setQueryState("");
    setResults([]);
    setHasSearched(false);
    setIsSearching(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
  }, []);

  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => doSearch(q), 300);
    },
    [doSearch]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return (
    <SearchContext.Provider
      value={{
        query,
        results,
        isSearching,
        hasSearched,
        isActive: query.trim().length > 0,
        setQuery,
        handleChange,
        handleClear,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within SearchProvider");
  return ctx;
}

/** Renders the search input — place in header */
export function SearchInput({
  className,
  inputClassName,
}: {
  className?: string;
  inputClassName?: string;
}) {
  const { query, isActive, handleChange, handleClear } = useSearch();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sceneAccent = useSceneAccent(undefined, query || "search");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.activeElement !== inputRef.current) return;
      if (query.trim()) {
        handleClear();
      }
      inputRef.current?.blur();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClear, query]);

  return (
    <div className={cn("relative w-72", className)} style={sceneAccent.cssVars}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        data-atlas-search="true"
        placeholder="Search tracks..."
        aria-label="Search tracks"
        className={cn("h-11 pl-9 pr-11", inputClassName)}
        value={query}
        onChange={handleChange}
      />
      {isActive && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={handleClear}
          className="focus-ring absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center text-muted-foreground transition-interactive duration-fast ease-out hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Renders search results when active, otherwise renders children (the SSR feed) */
export function SearchResults({ children }: { children: React.ReactNode }) {
  const { query, results, isSearching, hasSearched, isActive } = useSearch();

  if (!isActive) return <>{children}</>;

  return (
    <div>
      {isSearching && (
        <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-body-sm">Searching...</span>
        </div>
      )}

      {!isSearching && hasSearched && results.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-body-sm text-muted-foreground">
            No tracks match &ldquo;{query.trim()}&rdquo;
          </p>
        </div>
      )}

      {!isSearching && results.length > 0 && (
        <div>
          <h2 className="mb-4 text-h3 text-foreground">
            Search Results
            <span className="ml-2 text-body-sm font-normal text-muted-foreground">
              ({results.length})
            </span>
          </h2>
          <TrackList tracks={results} />
        </div>
      )}
    </div>
  );
}
