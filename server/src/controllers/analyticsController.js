const asyncHandler = require("../utils/asyncHandler");
const Appointment = require("../models/Appointment");

// The organization operates in IST (see availabilityController's own note on
// this) -- bucketing "busiest hour" without an explicit timezone would use
// the aggregation server's UTC hour instead, silently shifting every bucket
// by 5.5 hours on Render the same way slot creation once did.
const CLINIC_TIMEZONE = "+05:30";

const getAdminAnalytics = asyncHandler(async (req, res) => {
  const [revenueBySpecialization, hourBuckets, statusCounts, totalAppointments] = await Promise.all([
    Appointment.aggregate([
      { $match: { "payment.status": "paid" } },
      { $lookup: { from: "users", localField: "doctor", foreignField: "_id", as: "doctorInfo" } },
      { $unwind: "$doctorInfo" },
      {
        $group: {
          _id: { $ifNull: ["$doctorInfo.specialization", "General Practice"] },
          revenue: { $sum: "$payment.amount" },
          paidVisits: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Appointment.aggregate([
      { $project: { hour: { $hour: { date: "$date", timezone: CLINIC_TIMEZONE } } } },
      { $group: { _id: "$hour", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Appointment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Appointment.countDocuments(),
  ]);

  const statusMap = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
  const noShowCount = (statusMap.cancelled || 0) + (statusMap.rejected || 0);

  res.json({
    totalAppointments,
    revenueBySpecialization: revenueBySpecialization.map((r) => ({
      specialization: r._id,
      revenue: r.revenue,
      paidVisits: r.paidVisits,
    })),
    busiestHours: hourBuckets.map((h) => ({ hour: h._id, count: h.count })),
    statusCounts: statusMap,
    noShowRate: totalAppointments > 0 ? Math.round((noShowCount / totalAppointments) * 1000) / 10 : 0,
  });
});

module.exports = { getAdminAnalytics };
