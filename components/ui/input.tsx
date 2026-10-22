import type { ComponentProps } from "react";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`grade-input ${className}`} />;
}
