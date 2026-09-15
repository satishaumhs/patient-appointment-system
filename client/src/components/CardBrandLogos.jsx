// Simple, schematic card-brand badges -- not a reproduction of either
// company's actual logo artwork, just a widely recognizable stand-in (this
// is a demo payment form; see DemoPaymentForm.jsx).
export const VisaMark = ({ className = "h-5" }) => (
  <svg viewBox="0 0 48 30" className={className} role="img" aria-label="Visa">
    <rect width="48" height="30" rx="4" fill="#1A1F71" />
    <text x="24" y="20" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontWeight="700" fontSize="13" fill="#ffffff">
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
