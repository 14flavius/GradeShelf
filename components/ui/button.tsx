import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button"> & { variant?: "default" | "secondary" | "destructive" };

export function Button({
  className = "",
  variant = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button {...props} type={type} data-variant={variant} className={`grade-button ${className}`} />
  );
}
