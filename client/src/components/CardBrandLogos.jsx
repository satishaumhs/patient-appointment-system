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

export const GooglePayMark = ({ className = "h-5" }) => (
  <svg viewBox="0 0 48 30" className={className} role="img" aria-label="Google Pay">
    <rect width="48" height="30" rx="4" fill="#ffffff" stroke="#e5e7eb" />
    {/* Full "Google Pay" wordmark overflows this badge width at a legible
        size, so this uses Google's own compact "G Pay" lockup instead. */}
    <text x="24" y="19" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="11">
      <tspan fill="#4285F4">G</tspan>
      <tspan fill="#5f6368"> Pay</tspan>
    </text>
  </svg>
);

export const PhonePeMark = ({ className = "h-5" }) => (
  <svg viewBox="0 0 48 30" className={className} role="img" aria-label="PhonePe">
    <rect width="48" height="30" rx="4" fill="#5F259F" />
    <text x="24" y="19" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="9.5" fill="#ffffff">
      PhonePe
    </text>
  </svg>
);

export const PaytmMark = ({ className = "h-5" }) => (
  <svg viewBox="0 0 48 30" className={className} role="img" aria-label="Paytm">
    <rect width="48" height="30" rx="4" fill="#ffffff" stroke="#e5e7eb" />
    <text x="24" y="19" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="10.5" fontStyle="italic">
      <tspan fill="#002E6E">pay</tspan>
      <tspan fill="#00BAF2">tm</tspan>
    </text>
  </svg>
);
