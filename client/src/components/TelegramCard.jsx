import { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { SendIcon, CheckCircleIcon } from "./icons";

const PREFERENCES = [
  { key: "notifyNewRequest", label: "New appointment requests", hint: "With Accept/Reject buttons in the chat" },
  { key: "notifyStatusChange", label: "Patient cancellations", hint: "When a patient cancels their own visit" },
  { key: "notifyPayment", label: "Payment confirmations", hint: "When a demo payment comes through" },
];

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
      checked ? "bg-teal-600" : "bg-gray-300"
    }`}
  >
    <span
      className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);

// Doctor-only card for MyProfile.jsx. Connecting happens in another app
// (Telegram) with nothing pushing a "done" event back to this tab, so once a
// connect link is opened this polls status for a couple of minutes to pick
// up the link the moment it lands, instead of asking the doctor to refresh.
const TelegramCard = () => {
  const [status, setStatus] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef(null);

  const loadStatus = () => api.get("/telegram/status").then((res) => setStatus(res.data));

  useEffect(() => {
    loadStatus();
    return () => clearInterval(pollRef.current);
  }, []);

  const stopPolling = () => {
    clearInterval(pollRef.current);
    pollRef.current = null;
    setConnecting(false);
  };

  const handleConnect = async () => {
    setError("");
    try {
      const res = await api.get("/telegram/connect-link");
      window.open(res.data.url, "_blank", "noopener");
      setConnecting(true);

      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        const fresh = await api.get("/telegram/status").then((r) => r.data);
        if (fresh.connected) {
          setStatus(fresh);
          stopPolling();
        } else if (attempts >= 40) {
          stopPolling(); // link's 10-minute window has long since closed
        }
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Could not create a connect link");
    }
  };

  const handleDisconnect = async () => {
    setError("");
    try {
      await api.delete("/telegram/connect");
      await loadStatus();
    } catch (err) {
      setError(err.response?.data?.message || "Could not disconnect");
    }
  };

  const handleToggle = async (key, value) => {
    setStatus({ ...status, preferences: { ...status.preferences, [key]: value } });
    try {
      await api.patch("/telegram/preferences", { [key]: value });
    } catch {
      loadStatus(); // revert the optimistic flip if the save actually failed
    }
  };

  if (!status) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
          <SendIcon className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">Telegram notifications</h3>
        {status.connected && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            Connected
          </span>
        )}
      </div>

      {!status.connected ? (
        <>
          <p className="text-sm text-gray-500 mt-2 mb-4">
            Get a Telegram message the moment a patient books, with Accept/Reject buttons you can tap right from the
            chat — no need to open the dashboard.
          </p>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          {!connecting ? (
            <button
              type="button"
              onClick={handleConnect}
              className="inline-flex items-center gap-2 rounded-md bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700"
            >
              <SendIcon className="w-4 h-4" />
              Connect Telegram
            </button>
          ) : (
            <div className="flex items-center gap-2.5 text-sm text-gray-500">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              Waiting for you to tap Start in Telegram...
              <button type="button" onClick={stopPolling} className="text-gray-400 hover:text-gray-600 underline">
                Cancel
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-4">
            Connected since {new Date(status.linkedAt).toLocaleDateString()}
          </p>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="divide-y divide-gray-100 border-y border-gray-100">
            {PREFERENCES.map(({ key, label, hint }) => (
              <div key={key} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400">{hint}</p>
                </div>
                <Toggle checked={status.preferences[key]} onChange={(value) => handleToggle(key, value)} />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleDisconnect}
            className="mt-4 text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Disconnect Telegram
          </button>
        </>
      )}
    </div>
  );
};

export default TelegramCard;
