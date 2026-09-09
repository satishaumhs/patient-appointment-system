const WeekBarChart = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="flex items-end justify-between gap-3 h-40">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-2 h-full">
          <div className="flex-1 w-full flex items-end justify-center">
            <div
              className="w-full max-w-9 bg-teal-500 rounded-t-md"
              style={{ height: d.count > 0 ? `${(d.count / max) * 100}%` : "3px" }}
              title={`${d.count} appointment${d.count === 1 ? "" : "s"}`}
            />
          </div>
          <span className="text-xs text-gray-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

export default WeekBarChart;
