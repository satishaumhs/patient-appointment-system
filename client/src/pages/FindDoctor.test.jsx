import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import FindDoctor from "./FindDoctor";
import api from "../api/axios";

vi.mock("../api/axios", () => ({ default: { get: vi.fn() } }));

const doctors = [
  { _id: "d1", name: "Dr. Aisha Khan", specialization: "Cardiologist", consultationType: "in-person" },
  { _id: "d2", name: "Dr. Ben Ortiz", specialization: "Dermatologist", consultationType: "in-person" },
];

// A stand-in for the real nav dropdown: clicking it navigates to a new
// ?specialization= while staying on the /doctors route, same as the real
// Specialties dropdown does. React Router does not remount FindDoctor for
// this -- which is exactly the condition that caused the real bug.
const NavToOtherSpecialty = () => {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/doctors?specialization=Dermatologist")}>Switch to Dermatologist</button>;
};

const renderAt = (initialPath) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <NavToOtherSpecialty />
      <Routes>
        <Route path="/doctors" element={<FindDoctor />} />
      </Routes>
    </MemoryRouter>
  );

describe("FindDoctor", () => {
  beforeEach(() => {
    api.get.mockResolvedValue({ data: doctors });
  });

  it("re-syncs the specialty filter when the URL's ?specialization= changes without remounting", async () => {
    const user = userEvent.setup();
    renderAt("/doctors?specialization=Cardiologist");

    await waitFor(() => expect(screen.getByText("Dr. Aisha Khan")).toBeInTheDocument());
    expect(screen.queryByText("Dr. Ben Ortiz")).not.toBeInTheDocument();

    await user.click(screen.getByText("Switch to Dermatologist"));

    // This is the exact regression: without the searchParams-watching
    // effect in FindDoctor.jsx, the dropdown and results silently stayed
    // on "Cardiologist" here even though the URL had already changed.
    await waitFor(() => expect(screen.getByText("Dr. Ben Ortiz")).toBeInTheDocument());
    expect(screen.queryByText("Dr. Aisha Khan")).not.toBeInTheDocument();
  });

  it("shows every doctor when no specialization is in the URL", async () => {
    renderAt("/doctors");

    await waitFor(() => expect(screen.getByText("Dr. Aisha Khan")).toBeInTheDocument());
    expect(screen.getByText("Dr. Ben Ortiz")).toBeInTheDocument();
  });
});
