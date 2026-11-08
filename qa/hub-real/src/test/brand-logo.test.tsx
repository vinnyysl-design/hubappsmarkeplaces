import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import BrandLogo from "@/components/BrandLogo";

afterEach(() => { cleanup(); document.documentElement.classList.remove("light", "dark"); });
describe("owner-provided local branding", () => {
  it("uses a local symbol without a Lovable asset endpoint", () => {
    render(<BrandLogo variant="symbol" className="h-8 w-8" />);
    const image = screen.getByAltText("Analytical X");
    expect(image.getAttribute("src")).toContain("brand-symbol.png");
    expect(image.getAttribute("src")).not.toContain("/__l5e/");
    expect(image.className).toContain("object-contain");
  });
  for (const theme of ["light", "dark"]) it(`provides the original pair with CSS-only ${theme} switching`, () => {
    document.documentElement.classList.add(theme);
    render(<BrandLogo className="w-44 max-w-full" />);
    const mark = screen.getByRole("img", { name: "Analytical X" });
    const images = mark.querySelectorAll("img");
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute("src")).toContain("brand-on-dark.png");
    expect(images[0].className).toContain("[.light_&]:hidden");
    expect(images[1].getAttribute("src")).toContain("brand-on-light.png");
    expect(images[1].className).toContain("[.light_&]:block");
    expect(mark.className).toContain("max-w-full");
    expect(mark.className).toContain("aspect-[3/1]");
  });
});
