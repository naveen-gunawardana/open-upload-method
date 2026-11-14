"use client";

import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";

const VideoSelection = createContext<{ video: File | null; setVideo: Dispatch<SetStateAction<File | null>> } | null>(null);

// Keep a dropped file in memory during client navigation. Never persist or upload it.
export default function VideoSelectionProvider({ children }: { children: ReactNode }) {
  const [video, setVideo] = useState<File | null>(null);
  return <VideoSelection value={{ video, setVideo }}>{children}</VideoSelection>;
}

export function useVideoSelection() {
  const selection = useContext(VideoSelection);
  if (!selection) throw new Error("Video selection provider is missing");
  return selection;
}
