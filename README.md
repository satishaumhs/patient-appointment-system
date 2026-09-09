# Patient Appointment System

A full-stack appointment booking system for patients, doctors, and admins.

## Stack

- **Backend**: Node.js, Express 5, MongoDB (Mongoose), JWT auth (httpOnly cookie)
- **Frontend**: React 19, Vite, Tailwind CSS v4, React Router
- **Testing**: Jest + Supertest (backend, in-memory MongoDB)

## Features

- Registration/login with role-based access (patient / doctor / admin)
- Doctors define bookable time slots; patients book from real availability
- Booking is race-safe — two patients can never claim the same slot
- Appointment status workflow: pending → confirmed/cancelled → completed
- Admin dashboard for managing users and viewing all appointments

## Getting started

### Prerequisites

- Node.js 18+
- A MongoDB connection string (e.g. a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster)

### Backend

```bash
cd server
npm install
cp .env.example .env   # then fill in MONGO_URI and a real JWT_SECRET
npm run dev
```

Runs on `http://localhost:5000`.

### Frontend

```bash
cd client
npm install
npm run dev
```

Runs on `http://localhost:5173`.

### Running tests

```bash
cd server
npm test
```

Tests run against an in-memory MongoDB instance — no real database or `.env` needed.

## Project structure

```
server/
  src/
    app.js            Express app (routes, middleware) — imported by both server.js and tests
    server.js          Entry point: connects to MongoDB, starts listening
    config/db.js        Mongoose connection
    models/             User, Appointment, Availability
    controllers/         Route handlers
    routes/               Express routers
    middleware/           auth (JWT + RBAC), centralized error handling, validation
    validators/            express-validator request schemas
    tests/                Jest + Supertest suite

client/
  src/
    api/axios.js          Axios instance (withCredentials: true, for the auth cookie)
    context/AuthContext.jsx  Session state (checks /auth/me on load)
    components/            Navbar, ProtectedRoute
    pages/                 Login, Register, Dashboard, BookAppointment, ManageAvailability, AdminUsers
```

## API overview

All routes are under `/api`. Protected routes require the `token` httpOnly cookie set by login/register.

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Register as patient or doctor |
| POST | `/auth/login` | public | Log in |
| POST | `/auth/logout` | authenticated | Clear session |
| GET | `/auth/me` | authenticated | Current user |
| GET | `/users/doctors` | authenticated | List doctors (for booking) |
| GET | `/users` | admin | List all users |
| DELETE | `/users/:id` | admin | Remove a user (cascades their appointments/slots) |
| POST | `/availability` | doctor | Bulk-generate bookable slots for a day |
| GET | `/availability/mine` | doctor | Doctor's own upcoming slots |
| GET | `/availability/:doctorId` | authenticated | A doctor's open future slots (optional `?date=`) |
| DELETE | `/availability/:id` | doctor (owner) | Remove an unbooked slot |
| POST | `/appointments` | patient | Book an available slot |
| GET | `/appointments` | authenticated | List appointments, scoped by role |
| GET | `/appointments/:id` | authenticated (owner/admin) | Get one appointment |
| PATCH | `/appointments/:id/status` | authenticated | Update status (patients: cancel only; doctors: confirm/complete/cancel own) |
| DELETE | `/appointments/:id` | admin | Remove an appointment |

Admin accounts aren't self-serve — promote a user by setting `role: "admin"` directly in the database.
