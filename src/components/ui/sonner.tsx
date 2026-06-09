"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      richColors
      toastOptions={{
        style: {
          fontFamily: "var(--font-sans)",
        },
      }}
      {...props}
    />
  );
}
