"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Track } from "@atlas/shared";
import { audioUrl } from "@atlas/shared";

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number; // 0-1
  volume: number; // 0-1
  muted: boolean;
  queue: Track[];
  error: string | null;
  buffering: boolean;
}

interface PlayerActions {
  play: (track: Track) => void;
  pause: () => void;
  resume: () => void;
  togglePlay: (track?: Track) => void;
  next: () => void;
  prev: () => void;
  seek: (position: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setQueue: (tracks: Track[]) => void;
  addToQueue: (track: Track) => void;
}

type PlayerContextValue = PlayerState & PlayerActions;

const PlayerContext = createContext<PlayerContextValue | null>(null);

function describePlaybackIssue(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;

  const maybeError = error as { name?: unknown; message?: unknown; code?: unknown };
  const name = typeof maybeError.name === "string" ? maybeError.name : "";
  const message = typeof maybeError.message === "string" ? maybeError.message : "";

  if (name === "AbortError") return null;
  if (name === "NotAllowedError") {
    return "Playback was blocked by the browser. Try pressing play again.";
  }
  if (message) return message;
  if (name) return name;
  if (typeof maybeError.code === "number") return `Media error ${maybeError.code}`;
  return null;
}

function isExpectedPlaybackRejection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { name?: unknown };
  return maybeError.name === "AbortError" || maybeError.name === "NotAllowedError";
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolumeState] = useState(0.75);
  const [muted, setMuted] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeBeforeMuteRef = useRef(0.75);
  const currentTrackRef = useRef<Track | null>(null);
  const queueRef = useRef<Track[]>([]);
  const progressRef = useRef(0);
  const changingSourceRef = useRef(false);

  // Keep refs in sync for use in event handlers
  currentTrackRef.current = currentTrack;
  queueRef.current = queue;
  progressRef.current = progress;

  // Create the audio element once on mount
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.75;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setProgress(audio.currentTime / audio.duration);
      }
    };

    const onEnded = () => {
      changingSourceRef.current = false;
      const track = currentTrackRef.current;
      const q = queueRef.current;
      if (!track || q.length === 0) {
        setIsPlaying(false);
        setProgress(0);
        return;
      }
      const idx = q.findIndex((t) => t.id === track.id);
      if (idx >= 0 && q.length > 1) {
        const nextTrack = q[(idx + 1) % q.length];
        setCurrentTrack(nextTrack);
        setProgress(0);
        setError(null);
        changingSourceRef.current = true;
        audio.src = audioUrl(nextTrack.id);
        audio.play().catch(() => {});
      } else {
        setIsPlaying(false);
        setProgress(0);
      }
    };

    const onError = () => {
      const code = audio.error?.code;
      const message = audio.error?.message;
      const isSourceSwap = changingSourceRef.current;
      changingSourceRef.current = false;

      // Ignore benign media errors that can fire when a track naturally ends
      // or when the source is intentionally switched.
      if (!code || code === 1 || audio.ended || (isSourceSwap && !message)) {
        setBuffering(false);
        return;
      }

      const details = {
        code,
        message,
        trackId: currentTrackRef.current?.id,
      };
      if (code || message) {
        console.error("Audio playback failed", details);
      }
      setError("Playback unavailable. Try again.");
      setIsPlaying(false);
      setBuffering(false);
    };

    const onWaiting = () => setBuffering(true);
    const onCanPlay = () => {
      changingSourceRef.current = false;
      setBuffering(false);
      setError(null);
    };
    const onPlaying = () => {
      changingSourceRef.current = false;
      setBuffering(false);
      setError(null);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("playing", onPlaying);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("playing", onPlaying);
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Sync volume to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
  }, [muted, volume]);

  const play = useCallback(
    (track: Track) => {
      // Guard: don't play non-READY tracks
      if (track.status !== "READY") {
        if (track.status === "PENDING" || track.status === "PROCESSING") {
          setError("Track is still processing.");
        } else {
          setError("Playback unavailable. Try again.");
        }
        setIsPlaying(false);
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;

      setError(null);

      if (currentTrack?.id !== track.id) {
        setProgress(0);
        changingSourceRef.current = true;
        audio.src = audioUrl(track.id);
      }

      setCurrentTrack(track);
      setIsPlaying(true);
      audio.play().catch((err) => {
        const message = describePlaybackIssue(err);
        if (message) {
          const log = isExpectedPlaybackRejection(err) ? console.warn : console.error;
          log("Audio play() rejected", {
            message,
            trackId: track.id,
          });
          setError(message);
        }
        setIsPlaying(false);
        setBuffering(false);
      });
    },
    [currentTrack],
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setIsPlaying(true);
    audio.play().catch((err) => {
      const message = describePlaybackIssue(err);
      if (message) {
        const log = isExpectedPlaybackRejection(err) ? console.warn : console.error;
        log("Audio resume rejected", {
          message,
          trackId: currentTrackRef.current?.id,
        });
        setError(message);
      }
      setIsPlaying(false);
      setBuffering(false);
    });
  }, []);

  const togglePlay = useCallback(
    (track?: Track) => {
      if (track && currentTrack?.id !== track.id) {
        play(track);
      } else if (isPlaying) {
        pause();
      } else if (currentTrack) {
        resume();
      } else if (track) {
        play(track);
      }
    },
    [currentTrack, isPlaying, play, pause, resume],
  );

  const next = useCallback(() => {
    if (!currentTrack || queue.length === 0) return;
    const audio = audioRef.current;
    if (!audio) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    const nextTrack = queue[(idx + 1) % queue.length];
    setCurrentTrack(nextTrack);
    setProgress(0);
    setError(null);
    setIsPlaying(true);
    changingSourceRef.current = true;
    audio.src = audioUrl(nextTrack.id);
    audio.play().catch((err) => {
      const message = describePlaybackIssue(err);
      if (message) {
        console.error("Audio next() rejected", {
          message,
          trackId: nextTrack.id,
        });
        setError(message);
      }
      setIsPlaying(false);
      setBuffering(false);
    });
  }, [currentTrack, queue]);

  const prev = useCallback(() => {
    if (!currentTrack || queue.length === 0) return;
    const audio = audioRef.current;
    if (!audio) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    const prevTrack = queue[(idx - 1 + queue.length) % queue.length];
    setCurrentTrack(prevTrack);
    setProgress(0);
    setError(null);
    setIsPlaying(true);
    changingSourceRef.current = true;
    audio.src = audioUrl(prevTrack.id);
    audio.play().catch((err) => {
      const message = describePlaybackIssue(err);
      if (message) {
        console.error("Audio prev() rejected", {
          message,
          trackId: prevTrack.id,
        });
        setError(message);
      }
      setIsPlaying(false);
      setBuffering(false);
    });
  }, [currentTrack, queue]);

  const seek = useCallback((position: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration || !Number.isFinite(audio.duration)) return;
    const clamped = Math.max(0, Math.min(1, position));
    audio.currentTime = clamped * audio.duration;
    setProgress(clamped);
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (clamped > 0 && muted) {
      setMuted(false);
    }
    if (clamped > 0) {
      volumeBeforeMuteRef.current = clamped;
    }
  }, [muted]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      if (prev) {
        const restoreTo = Math.max(0.1, volumeBeforeMuteRef.current);
        setVolumeState(restoreTo);
        return false;
      }
      if (volume > 0) {
        volumeBeforeMuteRef.current = volume;
      }
      setVolumeState(0);
      return true;
    });
  }, [volume]);

  const addToQueue = useCallback((track: Track) => {
    if (track.status !== "READY") return;
    setQueue((prev) => {
      if (prev.some((t) => t.id === track.id)) return prev;
      return [...prev, track];
    });
  }, []);

  useEffect(() => {
    const isTextInput = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if (event.key === "/" && !isTextInput(event.target)) {
        event.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[data-atlas-search="true"]'
        );
        searchInput?.focus();
        searchInput?.select();
        return;
      }

      if (isTextInput(event.target)) return;

      if (event.key === " ") {
        event.preventDefault();
        togglePlay();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (event.shiftKey) {
          next();
        } else {
          seek(progressRef.current + 0.02);
        }
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (event.shiftKey) {
          prev();
        } else {
          seek(progressRef.current - 0.02);
        }
        return;
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, prev, seek, toggleMute, togglePlay]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        progress,
        volume,
        muted,
        queue,
        error,
        buffering,
        play,
        pause,
        resume,
        togglePlay,
        next,
        prev,
        seek,
        setVolume,
        toggleMute,
        setQueue,
        addToQueue,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within <PlayerProvider>");
  return ctx;
}
