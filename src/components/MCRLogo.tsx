type Props = {
  className?: string;
  variant?: "dark" | "light";
};

export function MCRLogo({ className = "h-10", variant = "dark" }: Props) {
  return (
    <img
      src="https://moderncompactorrepair.com/wp-content/uploads/2022/03/modern-logo.png"
      alt="Modern Compactor Repair"
      className={className}
      style={variant === "light" ? { filter: "brightness(0) invert(1)" } : undefined}
    />
  );
}
