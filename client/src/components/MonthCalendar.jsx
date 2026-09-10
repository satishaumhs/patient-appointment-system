import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDateKey = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const MonthCalendar = ({ selectedDate, onSelectDate, availableDates }) => {
  const [viewDate, setViewDate] = useState(() => {
    const base = selectedDate ? new Date(selectedDate) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(today);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  const changeMonth = (delta) => setViewDate(new Date(year, month + delta, 1));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-semibold text-gray-900">
          {viewDate.toLocaleDateString([], { month: "long", year: "numeric" })}
        </h3>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
          aria-label="Next month"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
        {DAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />;

          const cellDate = new Date(year, month, day);
          const dateKey = toDateKey(cellDate);
          const isPast = cellDate < today;
          const isToday = dateKey === todayKey;
          const isSelected = selectedDate === dateKey;
          const hasSlots = availableDates.has(dateKey);

          return (
            <button
              key={dateKey}
              type="button"
              disabled={isPast}
              onClick={() => onSelectDate(dateKey)}
              className={`relative h-9 rounded-md text-sm flex items-center justify-center transition-colors ${
                isPast
                  ? "text-gray-300 cursor-not-allowed"
                  : isSelected
                    ? "bg-teal-600 text-white font-medium"
                    : isToday
                      ? "text-teal-700 font-medium ring-1 ring-inset ring-teal-300"
                      : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {day}
              {hasSlots && !isSelected && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-teal-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> Has open slots
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full ring-1 ring-inset ring-teal-300" /> Today
        </span>
      </div>
    </div>
  );
};

export default MonthCalendar;
