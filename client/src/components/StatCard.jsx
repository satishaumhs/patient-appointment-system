const TINTS = {
  teal: "bg-teal-100 text-teal-700",
  blue: "bg-blue-100 text-blue-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
  gray: "bg-gray-100 text-gray-700",
};

const StatCard = ({ icon: Icon, label, value, tint = "teal" }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
    <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${TINTS[tint]}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <p className="text-xl font-semibold text-gray-900 leading-tight">{value}</p>
      <p className="text-xs text-gray-500 truncate">{label}</p>
    </div>
  </div>
);

export default StatCard;
