// Simple, schematic card-brand badges -- not a reproduction of either
// company's actual logo artwork, just a widely recognizable stand-in (this
// is a demo payment form; see DemoPaymentForm.jsx).
//
// Every mark's <text> below pins textLength + lengthAdjust="spacingAndGlyphs"
// to a fixed width well inside the 48-unit-wide badge. Without it, the
// rendered width depends on whichever font the requested family actually
// resolves to on that system -- "Arial" specifically doesn't exist on Linux,
// so a CI run substitutes a different font with different glyph widths than
// local dev. That's exactly what caused the Google Pay wordmark to clip in
// the first place, and PhonePe had almost no margin left even after that
// fix (~3 of 48 units) -- pinning textLength makes every mark's rendered
// width deterministic regardless of the actual font, not just tuned to
// whichever one happened to be installed wherever it was last checked.
export const VisaMark = ({ className = "h-5" }) => (
  <svg viewBox="0 0 48 30" className={className} role="img" aria-label="Visa">
    <rect width="48" height="30" rx="4" fill="#1A1F71" />
    <text
      x="24"
      y="20"
      textAnchor="middle"
      fontFamily="Georgia, serif"
      fontStyle="italic"
      fontWeight="700"
      fontSize="13"
      fill="#ffffff"
      textLength="36"
      lengthAdjust="spacingAndGlyphs"
    >
      VISA
    </text>
  </svg>
);

export const MastercardMark = ({ className = "h-5" }) => (
  <svg viewBox="0 0 48 30" className={className} role="img" aria-label="Mastercard">
    <rect width="48" height="30" rx="4" fill="#ffffff" stroke="#e5e7eb" />
    <circle cx="20" cy="15" r="8.5" fill="#EB001B" />
    <circle cx="28" cy="15" r="8.5" fill="#F79E1B" fillOpacity="0.85" />
  </svg>
);

export const GooglePayMark = ({ className = "h-5" }) => (
  <svg viewBox="0 0 48 30" className={className} role="img" aria-label="Google Pay">
    <rect width="48" height="30" rx="4" fill="#ffffff" stroke="#e5e7eb" />
    {/* Full "Google Pay" wordmark overflows this badge width at a legible
        size, so this uses Google's own compact "G Pay" lockup instead. */}
    <text
      x="24"
      y="19"
      textAnchor="middle"
      fontFamily="Arial, sans-serif"
      fontWeight="700"
      fontSize="11"
      textLength="34"
      lengthAdjust="spacingAndGlyphs"
    >
      <tspan fill="#4285F4">G</tspan>
      <tspan fill="#5f6368"> Pay</tspan>
    </text>
  </svg>
);

export const PhonePeMark = ({ className = "h-5" }) => (
  <svg viewBox="0 0 48 30" className={className} role="img" aria-label="PhonePe">
    <rect width="48" height="30" rx="4" fill="#5F259F" />
    <text
      x="24"
      y="19"
      textAnchor="middle"
      fontFamily="Arial, sans-serif"
      fontWeight="700"
      fontSize="9.5"
      fill="#ffffff"
      textLength="38"
      lengthAdjust="spacingAndGlyphs"
    >
      PhonePe
    </text>
  </svg>
);

export const PaytmMark = ({ className = "h-5" }) => (
  <svg viewBox="0 0 48 30" className={className} role="img" aria-label="Paytm">
    <rect width="48" height="30" rx="4" fill="#ffffff" stroke="#e5e7eb" />
    <text
      x="24"
      y="19"
      textAnchor="middle"
      fontFamily="Arial, sans-serif"
      fontWeight="800"
      fontSize="10.5"
      fontStyle="italic"
      textLength="36"
      lengthAdjust="spacingAndGlyphs"
    >
      <tspan fill="#002E6E">pay</tspan>
      <tspan fill="#00BAF2">tm</tspan>
    </text>
  </svg>
);
