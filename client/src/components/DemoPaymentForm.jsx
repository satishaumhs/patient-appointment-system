import { useState } from "react";
import api from "../api/axios";
import { CreditCardIcon } from "./icons";

const plainInputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600";

// Demo only -- no real payment gateway. Card/UPI fields are cosmetic and are
// never sent anywhere; the backend only needs to know a method was chosen.
const INACTIVE_STATUSES = ["cancelled", "rejected"];

const formatCardNumber = (value) =>
  value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

const formatExpiry = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

const formatCvv = (value) => value.replace(/\D/g, "").slice(0, 3);

const DemoPaymentForm = ({ payment, appointmentStatus, referenceNumber, phone, onPaid }) => {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("card");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [upiId, setUpiId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!payment || payment.status === "not_required") return null;

  const isActive = !INACTIVE_STATUSES.includes(appointmentStatus);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await api.post(`/appointments/status/${referenceNumber}/pay`, { phone, method });
      onPaid(res.data.payment);
      setOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || "Payment failed, please try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
          <CreditCardIcon className="w-4 h-4 text-gray-400" />
          Consultation fee
        </p>
        <p className="text-sm font-semibold text-gray-900">₹{payment.amount}</p>
      </div>

      {payment.status === "paid" ? (
        <p className="text-xs text-green-700 bg-green-50 inline-block px-2 py-1 rounded-md mt-1">
          Paid (demo) · {payment.transactionId}
        </p>
      ) : !isActive ? (
        <p className="text-xs text-gray-500 bg-gray-50 inline-block px-2 py-1 rounded-md mt-1">
          No payment needed — this appointment was {appointmentStatus}
        </p>
      ) : (
        <>
          <p className="text-xs text-amber-700 bg-amber-50 inline-block px-2 py-1 rounded-md mt-1">
            Payment pending — you can also pay at the clinic
          </p>
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="w-full mt-3 rounded-md border border-teal-600 text-teal-700 py-2 text-sm font-medium hover:bg-teal-50"
            >
              Pay now (demo)
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="mt-3 space-y-3 bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">
                Demo payment — no real charge is made. Don't enter real card details.
              </p>
              <div className="flex gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="payMethod"
                    checked={method === "card"}
                    onChange={() => setMethod("card")}
                  />
                  Card
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="payMethod" checked={method === "upi"} onChange={() => setMethod("upi")} />
                  UPI
                </label>
              </div>
              {method === "card" ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="4242 4242 4242 4242"
                    inputMode="numeric"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                    className={`col-span-2 ${plainInputClass}`}
                  />
                  <input
                    placeholder="MM/YY"
                    inputMode="numeric"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    maxLength={5}
                    className={plainInputClass}
                  />
                  <input
                    placeholder="CVV"
                    inputMode="numeric"
                    value={cvv}
                    onChange={(e) => setCvv(formatCvv(e.target.value))}
                    maxLength={3}
                    className={plainInputClass}
                  />
                </div>
              ) : (
                <input
                  placeholder="yourname@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className={plainInputClass}
                />
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-gray-300 text-gray-700 px-3 py-2 text-xs font-medium hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-md bg-teal-600 text-white py-2 text-xs font-medium hover:bg-teal-700 disabled:opacity-50"
                >
                  {submitting ? "Processing..." : `Pay ₹${payment.amount} (Demo)`}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
};

export default DemoPaymentForm;
