import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { VisaMark, MastercardMark, GooglePayMark, PhonePeMark, PaytmMark } from "./CardBrandLogos";

describe("CardBrandLogos", () => {
  it("renders every mark with an accessible name", () => {
    render(
      <div>
        <VisaMark />
        <MastercardMark />
        <GooglePayMark />
        <PhonePeMark />
        <PaytmMark />
      </div>
    );

    ["Visa", "Mastercard", "Google Pay", "PhonePe", "Paytm"].forEach((label) => {
      expect(screen.getByRole("img", { name: label })).toBeInTheDocument();
    });
  });

  it("keeps every mark's label text within its own badge bounds (0-48 viewBox)", () => {
    // jsdom has no real layout engine, so this can't measure rendered pixel
    // width the way the live-browser check did -- it only guards against
    // the label text itself being replaced with something implausibly long
    // for a 48-unit badge, as a cheap regression tripwire.
    render(
      <div>
        <VisaMark />
        <MastercardMark />
        <GooglePayMark />
        <PhonePeMark />
        <PaytmMark />
      </div>
    );

    screen.getAllByRole("img").forEach((svg) => {
      const text = svg.querySelector("text");
      if (text) expect(text.textContent.length).toBeLessThanOrEqual(10);
    });
  });
});
