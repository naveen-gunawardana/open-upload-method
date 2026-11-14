"use client";
import Link from "next/link";
import { type ReactNode } from "react";
import { useVideoSelection } from "@/components/VideoSelectionProvider";
import { useRouter } from "next/navigation";
import { patcherDestination } from "@/lib/conversion-analytics";

export default function PatcherLink({ children, className }: { children: ReactNode; className?: string }) {
  const { setVideo } = useVideoSelection();
  const router = useRouter();
  return <Link href="/convert" prefetch={false} className={className} onClick={event => {
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      setVideo(null);
      const destination = patcherDestination();
      if (destination !== "/convert") { event.preventDefault(); router.push(destination); }
    }
  }}>{children}</Link>;
}
