"use client";
import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";

export const PatcherContext = createContext<(() => void) | null>(null);
export default function PatcherLink({ children, className }: { children: ReactNode; className?: string }) {
  const open = useContext(PatcherContext);
  return <Link href="/convert" prefetch={false} className={className} onClick={event => {
    if (open && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault(); open();
    }
  }}>{children}</Link>;
}
