const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const authRoutes = require("./routes/authRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const userRoutes = require("./routes/userRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { authLimiter } = require("./middleware/rateLimiters");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/availability", availabilityRoutes);

app.get("/", (req, res) => {
  res.send("Patient Appointment Management API is running");
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
