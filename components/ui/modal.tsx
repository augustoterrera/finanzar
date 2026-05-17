"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

type ModalProps = {
  children: ReactNode;
  title: string;
  trigger: ReactNode;
};

export function Modal({ children, title, trigger }: ModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <span onClick={() => setIsOpen(true)}>{trigger}</span>
      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-0 md:place-items-center md:p-6"
          role="dialog"
        >
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[var(--shadow)] md:max-w-md md:rounded-lg md:pb-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{title}</h2>
              <button
                aria-label="Cerrar"
                className="flex size-10 items-center justify-center rounded-lg text-muted transition hover:bg-surface-muted hover:text-foreground"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
