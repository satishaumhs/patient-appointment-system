const COLORS = {
  pending: "#f59e0b",
  confirmed: "#2563eb",
  completed: "#0d9488",
  rejected: "#7c3aed",
  cancelled: "#dc2626",
};

const ORDER = ["pending", "confirmed", "completed", "rejected", "cancelled"];

const StatusDonut = ({ counts, activeKey = "", onSelect }) => {
  const total = ORDER.reduce((sum, key) => sum + (counts[key] || 0), 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const segments = ORDER.filter((key) => counts[key] > 0).map((key) => {
    const count = counts[key];
    const length = total > 0 ? (count / total) * circumference : 0;
    const offset = -cumulative;
    cumulative += length;
    return { key, count, length, offset };
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0">
        <g transform="rotate(-90 50 50)">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="12" />
          {segments.map((seg) => (
            <circle
              key={seg.key}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={COLORS[seg.key]}
              strokeWidth="12"
              strokeDasharray={`${seg.length} ${circumference - seg.length}`}
              strokeDashoffset={seg.offset}
              opacity={activeKey && activeKey !== seg.key ? 0.35 : 1}
              onClick={onSelect ? () => onSelect(seg.key) : undefined}
              className={onSelect ? "cursor-pointer" : undefined}
            />
          ))}
        </g>
        <text x="50" y="47" textAnchor="middle" className="fill-gray-900 text-[20px] font-semibold">
          {total}
        </text>
        <text x="50" y="62" textAnchor="middle" className="fill-gray-400 text-[8px]">
          Total
        </text>
      </svg>
      <div className="space-y-1">
        {ORDER.map((key) => {
          const Tag = onSelect ? "button" : "div";
          return (
            <Tag
              key={key}
              type={onSelect ? "button" : undefined}
              onClick={onSelect ? () => onSelect(activeKey === key ? "" : key) : undefined}
              className={`flex items-center gap-2 text-sm w-full px-1.5 py-1 rounded-md text-left ${
                onSelect ? "hover:bg-gray-50 cursor-pointer" : ""
              } ${activeKey === key ? "bg-gray-50" : ""}`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[key] }} />
              <span className={`capitalize ${activeKey === key ? "text-gray-900 font-medium" : "text-gray-600"}`}>
                {key}
              </span>
              <span className="text-gray-900 font-medium">{counts[key] || 0}</span>
            </Tag>
          );
        })}
      </div>
    </div>
  );
};

export default StatusDonut;
