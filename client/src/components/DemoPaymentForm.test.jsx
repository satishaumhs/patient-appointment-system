import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import DemoPaymentForm from "./DemoPaymentForm";

vi.mock("../api/axios", () => ({ default: { post: vi.fn() } }));

const pendingPayment = { status: "pending", amount: 800 };

const renderForm = (overrides = {}) =>
  render(
    <DemoPaymentForm
      payment={pendingPayment}
      appointmentStatus="pending"
      appointmentType="video"
      referenceNumber="MHS-11111"
      phone="9998887770"
      onPaid={() => {}}
      {...overrides}
    />
  );

describe("DemoPaymentForm", () => {
  it("shows card badges by default and switches to the UPI badges", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /pay now/i }));

    expect(screen.getByRole("img", { name: "Visa" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Mastercard" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Google Pay" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "UPI" }));

    // Regression coverage for the bug caught during live verification:
    // Google Pay's full wordmark used to overflow its badge and clip.
    expect(screen.getByRole("img", { name: "Google Pay" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "PhonePe" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Paytm" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Visa" })).not.toBeInTheDocument();
  });

  it("keeps the submit button disabled until a valid UPI id is entered", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /pay now/i }));
    await user.click(screen.getByRole("radio", { name: "UPI" }));

    const submit = screen.getByRole("button", { name: /pay ₹800/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByPlaceholderText("yourname@upi"), "patient@upi");
    expect(submit).toBeEnabled();
  });

  it("keeps the submit button disabled until a full 16-digit card number, valid expiry, and CVV are entered", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /pay now/i }));
    const submit = screen.getByRole("button", { name: /pay ₹800/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByPlaceholderText("4242 4242 4242 4242"), "4242424242424242");
    await user.type(screen.getByPlaceholderText("MM/YY"), "1228");
    expect(submit).toBeDisabled(); // CVV still missing

    await user.type(screen.getByPlaceholderText("CVV"), "123");
    expect(submit).toBeEnabled();
  });

  it("shows a paid confirmation instead of the form once payment.status is paid", () => {
    renderForm({ payment: { status: "paid", amount: 800, transactionId: "TXN123" } });

    expect(screen.getByText(/paid \(demo\)/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay now/i })).not.toBeInTheDocument();
  });

  it("renders nothing when payment is not required", () => {
    const { container } = renderForm({ payment: { status: "not_required", amount: 0 } });
    expect(container).toBeEmptyDOMElement();
  });
});
