"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MapFiltersProps {
  tab: string;
  onTabChange: (tab: string) => void;
  tempoRange: [number, number];
  onTempoChange: (range: [number, number]) => void;
  genre: string;
  onGenreChange: (genre: string) => void;
}

const genres = [
  "all",
  "ambient",
  "house",
  "electronica",
  "electronic",
  "dubstep",
  "downtempo",
  "lo-fi house",
  "ambient techno",
  "experimental",
];

export function MapFilters({
  tab,
  onTabChange,
  tempoRange,
  onTempoChange,
  genre,
  onGenreChange,
}: MapFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-6">
      {/* Tabs */}
      <div>
        <span className="mb-2 block text-caption font-medium text-muted-foreground">
          View
        </span>
        <Tabs value={tab} onValueChange={onTabChange}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="energy">Energy</TabsTrigger>
            <TabsTrigger value="mood">Mood</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tempo slider */}
      <div className="w-56">
        <span className="mb-2 block text-caption font-medium text-muted-foreground">
          Tempo: {tempoRange[0]}–{tempoRange[1]} BPM
        </span>
        <Slider
          min={80}
          max={160}
          step={1}
          value={tempoRange}
          onValueChange={(v) => onTempoChange(v as [number, number])}
        />
      </div>

      {/* Genre select */}
      <div className="w-44">
        <span className="mb-2 block text-caption font-medium text-muted-foreground">
          Genre
        </span>
        <Select value={genre} onValueChange={onGenreChange}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {genres.map((g) => (
              <SelectItem key={g} value={g}>
                {g === "all" ? "All genres" : g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
