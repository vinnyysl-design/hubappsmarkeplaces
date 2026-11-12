import onLight from "@/assets/brand-on-light.png";
import onDark from "@/assets/brand-on-dark.png";
import symbol from "@/assets/brand-symbol.png";

/** Owner-supplied originals. CSS framing only; source PNG bytes are unchanged. */
export default function BrandLogo({ variant = "full", className = "" }: { variant?: "full" | "symbol"; className?: string }) {
  if (variant === "symbol") return <img src={symbol} alt="Analytical X" className={`object-contain shrink-0 ${className}`} />;
  return (
    <span role="img" aria-label="Analytical X" className={`relative block aspect-[3/1] overflow-hidden shrink-0 ${className}`}>
      <img src={onDark} alt="" aria-hidden="true" className="absolute top-1/2 w-full h-auto -translate-y-1/2 object-contain [.light_&]:hidden" />
      <img src={onLight} alt="" aria-hidden="true" className="absolute top-1/2 hidden w-full h-auto -translate-y-1/2 object-contain [.light_&]:block" />
    </span>
  );
}
