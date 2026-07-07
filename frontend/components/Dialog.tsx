"use client";

import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 bg-[rgba(6,10,8,0.72)] backdrop-blur-[3px] flex items-center justify-center z-50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-[min(440px,calc(100vw-2.5rem))] bg-panel-raised border border-hairline-strong rounded-lg p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
      >
        <h2 className="font-display text-[1.375rem] mb-4">{title}</h2>
        {children}
      </div>
    </div>,
    document.body
  );
}
