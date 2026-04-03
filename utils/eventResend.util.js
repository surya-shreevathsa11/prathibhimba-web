import { Resend } from "resend";
import { Event } from "../models/events.model.js";

const resend = new Resend(process.env.RESEND_API_KEY);

const mailFromGuest = "Prathibhimba <mail@support.prathibhimbastays.com>";
const mailFromBookings = "Prathibhimba Bookings <mail@support.prathibhimbastays.com>";
const adminEmail = process.env.ADMIN_EMAIL;

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatRange(startDate, endDate) {
  if (!startDate && !endDate) return "—";
  if (startDate && endDate) return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  return startDate ? formatDate(startDate) : formatDate(endDate);
}

async function getEventForBooking(booking) {
  if (!booking?.eventId) return null;
  return Event.findById(booking.eventId).lean();
}

function buildEventConfirmationEmailHtml(event, booking) {
  const bookingDate = booking?.createdAt
    ? new Date(booking.createdAt).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const eventRange = formatRange(event?.startDate, event?.endDate);

  const amountPaid = booking.amountPaid || 0;
  const totalAmount = booking.totalAmount || 0;
  const balanceDue = totalAmount - amountPaid;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Event Booking – Prathibhimba</title>
</head>
<body style="margin:0;padding:0;background-color:#edeae2;font-family:Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#edeae2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="background:linear-gradient(160deg,#0d2b22 0%,#1a4035 60%,#2a5c4e 100%);border-radius:12px 12px 0 0;padding:48px 40px 36px;">
              <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:4px;color:#c9a84c;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Lakeside Retreat</p>
              <h1 style="margin:0;font-family:'Georgia',serif;font-size:42px;color:#f5f0e8;font-weight:normal;letter-spacing:1px;">Prathibhimba</h1>
              <div style="width:48px;height:2px;background:#c9a84c;margin:16px auto 20px;"></div>
              <p style="margin:0;font-size:13px;color:#a0b8b0;font-family:Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;">Madikeri, Coorg</p>
            </td>
          </tr>

          <!-- Confirmed Banner -->
          <tr>
            <td align="center" style="background:#c9a84c;padding:14px 40px;">
              <p style="margin:0;font-size:12px;letter-spacing:3px;color:#0d2b22;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">&#10003; &nbsp; Event Booking Confirmed</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;">

              <p style="margin:0 0 8px 0;font-family:'Georgia',serif;font-size:22px;color:#1a4035;">Dear ${booking.guest.name},</p>
              <p style="margin:0 0 22px 0;font-size:14px;color:#5a5548;line-height:1.8;">
                Thank you for booking with Prathibhimba. We're excited to confirm your reservation for our event.
              </p>

              <!-- Booking Reference -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f7f2;border:1px solid #ddd8cc;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 24px;border-bottom:1px solid #ddd8cc;">
                    <p style="margin:0;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Booking Reference</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Booking ID</span>
                        </td>
                        <td align="right" style="padding:4px 0;">
                          <span style="font-size:12px;color:#1a4035;font-family:'Courier New',monospace;font-weight:bold;">${booking._id}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Payment ID</span>
                        </td>
                        <td align="right" style="padding:4px 0;">
                          <span style="font-size:12px;color:#1a4035;font-family:'Courier New',monospace;">${booking.razorpayPaymentId || "—"}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Booked on</span>
                        </td>
                        <td align="right" style="padding:4px 0;">
                          <span style="font-size:12px;color:#1a4035;font-family:Helvetica,Arial,sans-serif;">${bookingDate}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Event Details -->
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Event Details</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f7f2;border:1px solid #ddd8cc;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:4px 0;width:40%;">
                          <span style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Event</span>
                        </td>
                        <td align="right" style="padding:4px 0;">
                          <span style="font-size:12px;color:#1a4035;font-family:Helvetica,Arial,sans-serif;">${event?.name || "—"}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Dates</span>
                        </td>
                        <td align="right" style="padding:4px 0;">
                          <span style="font-size:12px;color:#1a4035;font-family:Helvetica,Arial,sans-serif;">${eventRange}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Guests</span>
                        </td>
                        <td align="right" style="padding:4px 0;">
                          <span style="font-size:12px;color:#1a4035;font-family:Helvetica,Arial,sans-serif;">${booking.guest.guestCount} guest${booking.guest.guestCount !== 1 ? "s" : ""}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Guest Details -->
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Guest Details</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f7f2;border:1px solid #ddd8cc;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 24px;">
                    <table width="100%" cellpadding="4" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Name</td>
                        <td align="right" style="font-size:12px;color:#1a4035;font-family:Helvetica,Arial,sans-serif;">${booking.guest.name}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Email</td>
                        <td align="right" style="font-size:12px;color:#1a4035;font-family:Helvetica,Arial,sans-serif;">${booking.guest.email}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Phone</td>
                        <td align="right" style="font-size:12px;color:#1a4035;font-family:Helvetica,Arial,sans-serif;">${booking.guest.phone}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Payment Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #c9a84c;margin-top:8px;padding-top:16px;">
                <tr>
                  <td>
                    <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:#1a4035;">Total Amount</p>
                  </td>
                  <td align="right">
                    <p style="margin:0;font-family:'Georgia',serif;font-size:22px;color:#c9a84c;font-weight:bold;">&#8377;${totalAmount.toLocaleString("en-IN")}</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin:4px 0 0;font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Amount Paid</p>
                  </td>
                  <td align="right">
                    <p style="margin:4px 0 0;font-size:12px;color:#3a7a5a;font-family:Helvetica,Arial,sans-serif;">&#8377;${amountPaid.toLocaleString("en-IN")} &#10003;</p>
                  </td>
                </tr>
                ${
                  balanceDue > 0
                    ? `
                <tr>
                  <td>
                    <p style="margin:4px 0 0;font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Balance due on arrival</p>
                  </td>
                  <td align="right">
                    <p style="margin:4px 0 0;font-size:12px;color:#b05a2a;font-family:Helvetica,Arial,sans-serif;">&#8377;${balanceDue.toLocaleString("en-IN")}</p>
                  </td>
                </tr>`
                    : ""
                }
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background:linear-gradient(160deg,#0d2b22 0%,#1a4035 100%);border-radius:0 0 12px 12px;padding:28px 40px;">
              <p style="margin:0 0 8px;font-family:'Georgia',serif;font-size:16px;color:#f5f0e8;">Prathibhimba Lakeside Retreat</p>
              <p style="margin:0 0 4px;font-size:12px;color:#7aaa98;font-family:Helvetica,Arial,sans-serif;">Madikeri, Coorg, Karnataka</p>
              <p style="margin:12px 0 0;font-size:11px;color:#3a5a50;font-family:Helvetica,Arial,sans-serif;">This is an automated confirmation. Please do not reply to this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
`;
}

function buildEventAdminEmailHtml(event, booking) {
  const eventRange = formatRange(event?.startDate, event?.endDate);

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>New Event Booking – Admin</title></head>
<body style="margin:0;padding:0;background:#edeae2;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#edeae2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background:linear-gradient(160deg,#0d2b22 0%,#1a4035 100%);border-radius:12px 12px 0 0;padding:28px 40px;">
              <p style="margin:0;font-family:'Georgia',serif;font-size:24px;color:#f5f0e8;">&#128276; New Event Booking Received</p>
              <p style="margin:6px 0 0;font-size:12px;color:#7aaa98;font-family:Helvetica,Arial,sans-serif;">Prathibhimba Admin Notification</p>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff;padding:32px 40px;">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Event</p>
              <p style="margin:0 0 20px;font-family:'Georgia',serif;font-size:20px;color:#1a4035;">${event?.name || "—"}</p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f7f2;border:1px solid #ddd8cc;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 24px;">
                    <table width="100%" cellpadding="4" cellspacing="0" border="0">
                      <tr><td style="font-size:12px;color:#7a7260;">Event Dates</td><td align="right" style="font-size:12px;color:#1a4035;">${eventRange}</td></tr>
                      <tr><td style="font-size:12px;color:#7a7260;">Guest</td><td align="right" style="font-size:12px;color:#1a4035;">${booking.guest.name}</td></tr>
                      <tr><td style="font-size:12px;color:#7a7260;">Email</td><td align="right" style="font-size:12px;color:#1a4035;">${booking.guest.email}</td></tr>
                      <tr><td style="font-size:12px;color:#7a7260;">Phone</td><td align="right" style="font-size:12px;color:#1a4035;">${booking.guest.phone}</td></tr>
                      <tr><td style="font-size:12px;color:#7a7260;">Guests</td><td align="right" style="font-size:12px;color:#1a4035;">${booking.guest.guestCount}</td></tr>
                      <tr><td style="font-size:12px;color:#7a7260;">Booking ID</td><td align="right" style="font-size:12px;color:#1a4035;font-family:'Courier New',monospace;">${booking._id}</td></tr>
                      <tr><td style="font-size:12px;color:#7a7260;">Payment ID</td><td align="right" style="font-size:12px;color:#1a4035;font-family:'Courier New',monospace;">${booking.razorpayPaymentId || "—"}</td></tr>
                      <tr><td style="font-size:12px;color:#7a7260;">Total Amount</td><td align="right" style="font-size:13px;color:#c9a84c;font-weight:bold;">&#8377;${(booking.totalAmount || 0).toLocaleString("en-IN")}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 0;font-size:12px;color:#5a5548;font-family:Helvetica,Arial,sans-serif;line-height:1.6;">
                Please review this booking and follow up if needed.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="background:#1a4035;border-radius:0 0 12px 12px;padding:20px 40px;">
              <p style="margin:0;font-size:12px;color:#3a5a50;font-family:Helvetica,Arial,sans-serif;">Prathibhimba Admin · Automated Notification</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function buildEventPaymentFailedHtml(event, booking) {
  const eventRange = formatRange(event?.startDate, event?.endDate);

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Payment Failed – Prathibhimba</title></head>
<body style="margin:0;padding:0;background:#edeae2;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#edeae2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="background:linear-gradient(160deg,#0d2b22 0%,#1a4035 100%);border-radius:12px 12px 0 0;padding:48px 40px 36px;">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:4px;color:#c9a84c;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Lakeside Retreat</p>
              <h1 style="margin:0;font-family:'Georgia',serif;font-size:38px;color:#f5f0e8;font-weight:normal;">Prathibhimba</h1>
              <div style="width:48px;height:2px;background:#b05a2a;margin:16px auto 0;"></div>
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#b05a2a;padding:14px 40px;">
              <p style="margin:0;font-size:12px;letter-spacing:3px;color:#fff;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">&#9888; Payment Unsuccessful</p>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:40px;">
              <p style="margin:0 0 16px;font-family:'Georgia',serif;font-size:20px;color:#1a4035;">Dear ${booking.guest.name},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#5a5548;line-height:1.8;">
                We're sorry — your payment for the event booking at Prathibhimba could not be processed. Your reservation is still pending and has <strong>not</strong> been confirmed.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f7f2;border:1px solid #ddd8cc;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 24px;">
                    <table width="100%" cellpadding="4" cellspacing="0" border="0">
                      <tr><td style="font-size:12px;color:#7a7260;">Event</td><td align="right" style="font-size:12px;color:#1a4035;">${event?.name || "—"}</td></tr>
                      <tr><td style="font-size:12px;color:#7a7260;">Dates</td><td align="right" style="font-size:12px;color:#1a4035;">${eventRange}</td></tr>
                      <tr><td style="font-size:12px;color:#7a7260;">Booking ID</td><td align="right" style="font-size:12px;font-family:'Courier New',monospace;color:#1a4035;">${booking._id}</td></tr>
                      <tr><td style="font-size:12px;color:#7a7260;">Amount</td><td align="right" style="font-size:13px;color:#c9a84c;font-weight:bold;">&#8377;${(booking.totalAmount || 0).toLocaleString("en-IN")}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:14px;color:#5a5548;line-height:1.8;">
                Please try again or contact us on WhatsApp for help completing your booking.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="background:linear-gradient(160deg,#0d2b22 0%,#1a4035 100%);border-radius:0 0 12px 12px;padding:24px 40px;">
              <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:#f5f0e8;">Prathibhimba Lakeside Retreat</p>
              <p style="margin:6px 0 0;font-size:12px;color:#3a5a50;font-family:Helvetica,Arial,sans-serif;">Madikeri, Coorg, Karnataka</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export async function sendConfirmationMailToGuest(booking) {
  const event = await getEventForBooking(booking);
  await resend.emails.send({
    from: mailFromGuest,
    to: booking.guest.email,
    subject: `Event Booking Confirmed – Prathibhimba (#${booking._id})`,
    html: buildEventConfirmationEmailHtml(event, booking),
  });
}

export async function sendConfirmationMailToAdmin(booking) {
  const event = await getEventForBooking(booking);
  await resend.emails.send({
    from: mailFromBookings,
    to: adminEmail,
    subject: `New Event Booking: ${event?.name || "Prathibhimba Event"} – ₹${booking.totalAmount || 0}`,
    html: buildEventAdminEmailHtml(event, booking),
  });
}

export async function sendPaymentFailedMailToGuest(booking) {
  const event = await getEventForBooking(booking);
  await resend.emails.send({
    from: mailFromGuest,
    to: booking.guest.email,
    subject: `Payment Failed – Prathibhimba Event Booking`,
    html: buildEventPaymentFailedHtml(event, booking),
  });
}

function buildEventCancellationHtml(event, booking) {
  const eventRange = formatRange(event?.startDate, event?.endDate);
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Event Booking Cancelled – Prathibhimba</title></head>
<body style="margin:0;padding:0;background:#edeae2;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#edeae2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="background:linear-gradient(160deg,#0d2b22 0%,#1a4035 100%);border-radius:12px 12px 0 0;padding:48px 40px 36px;">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:4px;color:#c9a84c;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Lakeside Retreat</p>
              <h1 style="margin:0;font-family:'Georgia',serif;font-size:38px;color:#f5f0e8;font-weight:normal;">Prathibhimba</h1>
              <div style="width:48px;height:2px;background:#c9a84c;margin:16px auto 0;"></div>
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#6a3028;padding:14px 40px;">
              <p style="margin:0;font-size:12px;letter-spacing:3px;color:#fff;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">&#10005; &nbsp; Event Booking Cancelled</p>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:40px;">
              <p style="margin:0 0 16px;font-family:'Georgia',serif;font-size:20px;color:#1a4035;">Dear ${booking.guest.name},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#5a5548;line-height:1.8;">
                Your event booking at Prathibhimba has been cancelled. If you have questions about refunds or next steps, please contact us on WhatsApp.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f7f2;border:1px solid #ddd8cc;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 24px;">
                    <table width="100%" cellpadding="4" cellspacing="0" border="0">
                      <tr><td style="font-size:12px;color:#7a7260;">Event</td><td align="right" style="font-size:12px;color:#1a4035;">${event?.name || "—"}</td></tr>
                      <tr><td style="font-size:12px;color:#7a7260;">Dates</td><td align="right" style="font-size:12px;color:#1a4035;">${eventRange}</td></tr>
                      <tr><td style="font-size:12px;color:#7a7260;">Booking ID</td><td align="right" style="font-size:12px;font-family:'Courier New',monospace;color:#1a4035;">${booking._id}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background:linear-gradient(160deg,#0d2b22 0%,#1a4035 100%);border-radius:0 0 12px 12px;padding:24px 40px;">
              <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:#f5f0e8;">Prathibhimba Lakeside Retreat</p>
              <p style="margin:6px 0 0;font-size:12px;color:#3a5a50;font-family:Helvetica,Arial,sans-serif;">Madikeri, Coorg, Karnataka</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export async function sendEventCancellationMailToGuest(booking) {
  const event = await getEventForBooking(booking);
  await resend.emails.send({
    from: mailFromGuest,
    to: booking.guest.email,
    subject: `Event Booking Cancelled – Prathibhimba (#${booking._id})`,
    html: buildEventCancellationHtml(event, booking),
  });
}

