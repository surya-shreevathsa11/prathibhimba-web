import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const mailFromGuest = "Prathibhimba <mail@support.prathibhimbastays.com>";
const mailFromBookings = "Prathibhimba Bookings <mail@support.prathibhimbastays.com>";
const adminEmail = process.env.ADMIN_EMAIL;

// ─── Colours (Prathibhimba palette) ──────────────────────────────────────────
// Dark forest green  : #0d2b22   (header bg deep)
// Mid forest green   : #1a4035   (header bg)
// Light forest green : #2a5c4e   (header accent)
// Gold               : #c9a84c   (accent gold)
// Cream bg           : #f5f0e8
// Page bg            : #edeae2
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function nightsBetween(checkIn, checkOut) {
  const diff = new Date(checkOut) - new Date(checkIn);
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function buildRoomsHtml(rooms) {
  return rooms
    .map(function (room) {
      const nights = nightsBetween(room.checkIn, room.checkOut);
      const roomLabel = room.roomName || room.roomId;
      const roomType = room.type
        ? `<span style="font-size:11px;color:#c9a84c;letter-spacing:2px;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">${room.type}</span><br/>`
        : "";
      return `
        <div style="background:#f9f7f2;border:1px solid #ddd8cc;border-left:3px solid #c9a84c;border-radius:6px;padding:20px 24px;margin-bottom:16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                ${roomType}
                <p style="margin:4px 0 4px 0;font-family:'Georgia',serif;font-size:17px;color:#1a4035;font-weight:bold;">${roomLabel}</p>
                <p style="margin:0;font-size:13px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">
                  ${formatDate(room.checkIn)} &rarr; ${formatDate(room.checkOut)} &nbsp;&middot;&nbsp; ${nights} night${nights !== 1 ? "s" : ""}
                </p>
                <p style="margin:4px 0 0 0;font-size:13px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">
                  ${room.adults} Adult${room.adults !== 1 ? "s" : ""}${room.children > 0 ? ` &middot; ${room.children} Child${room.children !== 1 ? "ren" : ""}` : ""}
                </p>
              </td>
              <td align="right" valign="top">
                <p style="margin:0;font-family:'Georgia',serif;font-size:18px;color:#c9a84c;font-weight:bold;">&#8377;${room.price.toLocaleString("en-IN")}</p>
              </td>
            </tr>
          </table>
        </div>
      `;
    })
    .join("");
}

// ─── Guest Confirmation Email ─────────────────────────────────────────────────

function buildEmailHtml(booking) {
  const roomsHtml = buildRoomsHtml(booking.rooms);
  const bookingDate = new Date(booking.createdAt).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Booking Confirmation – Prathibhimba</title>
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
              <p style="margin:0;font-size:12px;letter-spacing:3px;color:#0d2b22;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">&#10003; &nbsp; Booking Confirmed</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;">

              <p style="margin:0 0 8px 0;font-family:'Georgia',serif;font-size:22px;color:#1a4035;">Dear ${booking.guest.name},</p>
              <p style="margin:0 0 28px 0;font-size:14px;color:#5a5548;line-height:1.8;">
                Thank you for choosing Prathibhimba. We're delighted to confirm your reservation and look forward to welcoming you to our lakeside retreat nestled in the serene hills of Madikeri, Coorg.
              </p>

              <!-- Booking Reference -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f7f2;border:1px solid #ddd8cc;border-radius:8px;margin-bottom:28px;">
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

              <!-- Guest Details -->
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Guest Details</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f7f2;border:1px solid #ddd8cc;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:4px 0;width:40%;">
                          <span style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Name</span>
                        </td>
                        <td align="right" style="padding:4px 0;">
                          <span style="font-size:12px;color:#1a4035;font-family:Helvetica,Arial,sans-serif;">${booking.guest.name}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Email</span>
                        </td>
                        <td align="right" style="padding:4px 0;">
                          <span style="font-size:12px;color:#1a4035;font-family:Helvetica,Arial,sans-serif;">${booking.guest.email}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Phone</span>
                        </td>
                        <td align="right" style="padding:4px 0;">
                          <span style="font-size:12px;color:#1a4035;font-family:Helvetica,Arial,sans-serif;">${booking.guest.phone}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Room(s) -->
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Your Room${booking.rooms.length > 1 ? "s" : ""}</p>
              ${roomsHtml}

              <!-- Payment Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #c9a84c;margin-top:8px;padding-top:16px;">
                <tr>
                  <td>
                    <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:#1a4035;">Total Amount</p>
                  </td>
                  <td align="right">
                    <p style="margin:0;font-family:'Georgia',serif;font-size:22px;color:#c9a84c;font-weight:bold;">&#8377;${booking.totalAmount.toLocaleString("en-IN")}</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin:4px 0 0;font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Amount Paid</p>
                  </td>
                  <td align="right">
                    <p style="margin:4px 0 0;font-size:12px;color:#3a7a5a;font-family:Helvetica,Arial,sans-serif;">&#8377;${booking.amountPaid.toLocaleString("en-IN")} &#10003;</p>
                  </td>
                </tr>
                ${
                  booking.totalAmount - booking.amountPaid > 0
                    ? `
                <tr>
                  <td>
                    <p style="margin:4px 0 0;font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Balance due on arrival</p>
                  </td>
                  <td align="right">
                    <p style="margin:4px 0 0;font-size:12px;color:#b05a2a;font-family:Helvetica,Arial,sans-serif;">&#8377;${(booking.totalAmount - booking.amountPaid).toLocaleString("en-IN")}</p>
                  </td>
                </tr>`
                    : ""
                }
              </table>

            </td>
          </tr>

          <!-- Info Strip -->
          <tr>
            <td style="background:#f9f7f2;border:1px solid #ddd8cc;border-top:none;padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="33%" align="center" style="padding:8px;">
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Check-in</p>
                    <p style="margin:0;font-family:'Georgia',serif;font-size:14px;color:#1a4035;">From 14:00</p>
                  </td>
                  <td width="1" style="background:#ddd8cc;">&nbsp;</td>
                  <td width="33%" align="center" style="padding:8px;">
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Check-out</p>
                    <p style="margin:0;font-family:'Georgia',serif;font-size:14px;color:#1a4035;">By 11:00</p>
                  </td>
                  <td width="1" style="background:#ddd8cc;">&nbsp;</td>
                  <td width="33%" align="center" style="padding:8px;">
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">WhatsApp</p>
                    <p style="margin:0;font-family:'Georgia',serif;font-size:14px;color:#1a4035;">+91 94484 33125</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cancellation Note -->
          <tr>
            <td style="background:#fdf8ed;border:1px solid #e5d9a8;border-top:none;padding:16px 40px;">
              <p style="margin:0;font-size:12px;color:#7a6020;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">
                <strong>Cancellation Policy:</strong> 100% refund if cancelled 15+ days before check-in. No refund after that. Cancellations must be requested via admin.
              </p>
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

// ─── Admin Notification Email ─────────────────────────────────────────────────

function buildAdminEmailHtml(booking) {
  const roomsHtml = buildRoomsHtml(booking.rooms);
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>New Booking – Admin</title></head>
<body style="margin:0;padding:0;background:#edeae2;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#edeae2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background:linear-gradient(160deg,#0d2b22 0%,#1a4035 100%);border-radius:12px 12px 0 0;padding:28px 40px;">
              <p style="margin:0;font-family:'Georgia',serif;font-size:24px;color:#f5f0e8;">&#128276; New Booking Received</p>
              <p style="margin:6px 0 0;font-size:12px;color:#7aaa98;font-family:Helvetica,Arial,sans-serif;">Prathibhimba Admin Notification</p>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px 40px;">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;">Guest</p>
              <p style="margin:0 0 20px;font-family:'Georgia',serif;font-size:20px;color:#1a4035;">${booking.guest.name}</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f7f2;border:1px solid #ddd8cc;border-radius:8px;margin-bottom:24px;">
                <tr><td style="padding:16px 24px;">
                  <table width="100%" cellpadding="4" cellspacing="0" border="0">
                    <tr><td style="font-size:12px;color:#7a7260;">Email</td><td align="right" style="font-size:12px;color:#1a4035;">${booking.guest.email}</td></tr>
                    <tr><td style="font-size:12px;color:#7a7260;">Phone</td><td align="right" style="font-size:12px;color:#1a4035;">${booking.guest.phone}</td></tr>
                    <tr><td style="font-size:12px;color:#7a7260;">Booking ID</td><td align="right" style="font-size:12px;color:#1a4035;font-family:'Courier New',monospace;">${booking._id}</td></tr>
                    <tr><td style="font-size:12px;color:#7a7260;">Razorpay Order</td><td align="right" style="font-size:12px;color:#1a4035;font-family:'Courier New',monospace;">${booking.razorpayOrderId}</td></tr>
                    <tr><td style="font-size:12px;color:#7a7260;">Payment ID</td><td align="right" style="font-size:12px;color:#1a4035;font-family:'Courier New',monospace;">${booking.razorpayPaymentId || "—"}</td></tr>
                    <tr><td style="font-size:12px;color:#7a7260;">Amount Paid</td><td align="right" style="font-size:13px;color:#3a7a5a;font-weight:bold;">&#8377;${booking.amountPaid.toLocaleString("en-IN")}</td></tr>
                    <tr><td style="font-size:12px;color:#7a7260;">Total Amount</td><td align="right" style="font-size:13px;color:#c9a84c;font-weight:bold;">&#8377;${booking.totalAmount.toLocaleString("en-IN")}</td></tr>
                  </table>
                </td></tr>
              </table>
              <p style="margin:0 0 12px;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;">Room${booking.rooms.length > 1 ? "s" : ""} Booked</p>
              ${roomsHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#1a4035;border-radius:0 0 12px 12px;padding:20px 40px;">
              <p style="margin:0;font-size:12px;color:#3a5a50;font-family:Helvetica,Arial,sans-serif;">Prathibhimba Admin &middot; Automated Notification</p>
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

// ─── Payment Failed Email ─────────────────────────────────────────────────────

function buildPaymentFailedHtml(booking) {
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
                We're sorry — your payment for the booking at Prathibhimba could not be processed. Your reservation is still pending and has <strong>not</strong> been confirmed.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f7f2;border:1px solid #ddd8cc;border-radius:8px;margin-bottom:24px;">
                <tr><td style="padding:16px 24px;">
                  <table width="100%" cellpadding="4" cellspacing="0" border="0">
                    <tr><td style="font-size:12px;color:#7a7260;">Booking ID</td><td align="right" style="font-size:12px;font-family:'Courier New',monospace;color:#1a4035;">${booking._id}</td></tr>
                    <tr><td style="font-size:12px;color:#7a7260;">Amount</td><td align="right" style="font-size:13px;color:#c9a84c;font-weight:bold;">&#8377;${booking.totalAmount.toLocaleString("en-IN")}</td></tr>
                  </table>
                </td></tr>
              </table>
              <p style="margin:0 0 8px;font-size:14px;color:#5a5548;line-height:1.8;">Please try again or contact us on WhatsApp and we'll help you complete your booking.</p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                <tr>
                  <td style="background:#c9a84c;border-radius:6px;padding:12px 28px;">
                    <a href="https://wa.me/919448433125" style="font-size:13px;color:#0d2b22;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Contact Us on WhatsApp</a>
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

// ─── Admin OTP Email ──────────────────────────────────────────────────────────

function buildAdminOTPHtml(otp) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Admin Login – Prathibhimba</title>
</head>
<body style="margin:0;padding:0;background-color:#edeae2;font-family:Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#edeae2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="background:linear-gradient(160deg,#0d2b22 0%,#1a4035 60%,#2a5c4e 100%);border-radius:12px 12px 0 0;padding:40px 40px 32px;">
              <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:4px;color:#c9a84c;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Lakeside Retreat</p>
              <h1 style="margin:0;font-family:'Georgia',serif;font-size:36px;color:#f5f0e8;font-weight:normal;letter-spacing:1px;">Prathibhimba</h1>
              <div style="width:40px;height:2px;background:#c9a84c;margin:14px auto 0;"></div>
            </td>
          </tr>

          <!-- Banner -->
          <tr>
            <td align="center" style="background:#c9a84c;padding:12px 40px;">
              <p style="margin:0;font-size:11px;letter-spacing:3px;color:#0d2b22;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">&#128274; &nbsp; Admin Login Verification</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 36px;">
              <p style="margin:0 0 8px;font-family:'Georgia',serif;font-size:20px;color:#1a4035;">Hello, Admin</p>
              <p style="margin:0 0 32px;font-size:14px;color:#5a5548;line-height:1.8;">
                A login attempt was made to the Prathibhimba admin panel. Use the OTP below to complete verification. Do not share this code with anyone.
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:#f9f7f2;border:1px solid #ddd8cc;border-top:3px solid #c9a84c;border-radius:8px;padding:28px 48px;margin-bottom:28px;">
                      <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Your One-Time Password</p>
                      <p style="margin:0;font-family:'Courier New',monospace;font-size:40px;font-weight:bold;letter-spacing:12px;color:#c9a84c;">${otp}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fdf8ed;border:1px solid #e5d9a8;border-radius:8px;margin-bottom:8px;">
                <tr>
                  <td style="padding:14px 20px;">
                    <p style="margin:0;font-size:12px;color:#7a6020;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">
                      &#9888;&nbsp; This OTP is valid for <strong>5 minutes</strong>. If you did not request this, please ignore this email and secure your account.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background:linear-gradient(160deg,#0d2b22 0%,#1a4035 100%);border-radius:0 0 12px 12px;padding:24px 40px;">
              <p style="margin:0 0 4px;font-family:'Georgia',serif;font-size:15px;color:#f5f0e8;">Prathibhimba Lakeside Retreat</p>
              <p style="margin:0 0 8px;font-size:12px;color:#7aaa98;font-family:Helvetica,Arial,sans-serif;">Madikeri, Coorg, Karnataka</p>
              <p style="margin:0;font-size:11px;color:#3a5a50;font-family:Helvetica,Arial,sans-serif;">support@prathibhimbastays.com</p>
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

// ─── Cancellation Email ───────────────────────────────────────────────────────

function buildCancellationHtml(booking) {
  const roomsHtml = (booking.rooms || [])
    .map(function (room) {
      const nights = Math.round(
        (new Date(room.checkOut) - new Date(room.checkIn)) /
          (1000 * 60 * 60 * 24)
      );
      const roomLabel = room.roomName || room.roomId;
      const roomType = room.type
        ? `<span style="font-size:11px;color:#c9a84c;letter-spacing:2px;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">${room.type}</span><br/>`
        : "";
      return `
        <div style="background:#f9f7f2;border:1px solid #ddd8cc;border-left:3px solid #8a6a5a;border-radius:6px;padding:20px 24px;margin-bottom:16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                ${roomType}
                <p style="margin:4px 0 4px 0;font-family:'Georgia',serif;font-size:17px;color:#3a3028;font-weight:bold;">${roomLabel}</p>
                <p style="margin:0;font-size:13px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">
                  ${new Date(room.checkIn).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
                  &rarr;
                  ${new Date(room.checkOut).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
                  &nbsp;&middot;&nbsp; ${nights} night${nights !== 1 ? "s" : ""}
                </p>
                <p style="margin:4px 0 0;font-size:13px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">
                  ${room.adults} Adult${room.adults !== 1 ? "s" : ""}${room.children > 0 ? ` &middot; ${room.children} Child${room.children !== 1 ? "ren" : ""}` : ""}
                </p>
              </td>
              <td align="right" valign="top">
                <p style="margin:0;font-family:'Georgia',serif;font-size:17px;color:#9a9080;text-decoration:line-through;">&#8377;${room.price.toLocaleString("en-IN")}</p>
              </td>
            </tr>
          </table>
        </div>
      `;
    })
    .join("");

  const isEligibleForRefund = booking.amountPaid > 0;
  const cancellationDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Booking Cancelled – Prathibhimba</title>
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
              <div style="width:48px;height:2px;background:#c9a84c;margin:16px auto 24px;"></div>
              <p style="margin:0;font-size:13px;color:#a0b8b0;font-family:Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;">Madikeri, Coorg</p>
            </td>
          </tr>

          <!-- Cancelled Banner -->
          <tr>
            <td align="center" style="background:#6a3028;padding:14px 40px;">
              <p style="margin:0;font-size:12px;letter-spacing:3px;color:#fff;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">&#10005; &nbsp; Booking Cancelled</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;">

              <p style="margin:0 0 8px 0;font-family:'Georgia',serif;font-size:22px;color:#1a4035;">Dear ${booking.guest.name},</p>
              <p style="margin:0 0 28px 0;font-size:14px;color:#5a5548;line-height:1.8;">
                We're sorry to inform you that your booking at Prathibhimba has been cancelled as of <strong>${cancellationDate}</strong>. We hope to welcome you another time.
              </p>

              <!-- Booking Reference -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f7f2;border:1px solid #ddd8cc;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:14px 24px;border-bottom:1px solid #ddd8cc;">
                    <p style="margin:0;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Cancellation Details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px;">
                    <table width="100%" cellpadding="4" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Booking ID</td>
                        <td align="right" style="font-size:12px;color:#1a4035;font-family:'Courier New',monospace;font-weight:bold;">${booking._id}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Cancelled on</td>
                        <td align="right" style="font-size:12px;color:#1a4035;font-family:Helvetica,Arial,sans-serif;">${cancellationDate}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Total Amount</td>
                        <td align="right" style="font-size:12px;color:#1a4035;font-family:Helvetica,Arial,sans-serif;">&#8377;${booking.totalAmount.toLocaleString("en-IN")}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#7a7260;font-family:Helvetica,Arial,sans-serif;">Amount Paid</td>
                        <td align="right" style="font-size:13px;color:${isEligibleForRefund ? "#6a3028" : "#1a4035"};font-family:Helvetica,Arial,sans-serif;font-weight:bold;">&#8377;${booking.amountPaid.toLocaleString("en-IN")}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Cancelled Rooms -->
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Cancelled Room${booking.rooms.length > 1 ? "s" : ""}</p>
              ${roomsHtml}

              <!-- Refund policy -->
              ${
                isEligibleForRefund
                  ? `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fdf8ed;border:1px solid #e5d9a8;border-radius:8px;margin-top:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;color:#7a6020;font-weight:bold;font-family:Helvetica,Arial,sans-serif;">Refund Information</p>
                    <p style="margin:0;font-size:12px;color:#7a6020;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">
                      A payment of <strong>&#8377;${booking.amountPaid.toLocaleString("en-IN")}</strong> was made on this booking.
                      As per our cancellation policy, refunds are applicable only if cancelled 15+ days before check-in.
                      Please contact us on WhatsApp for refund queries.
                    </p>
                  </td>
                </tr>
              </table>
              `
                  : `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f7f2;border:1px solid #ddd8cc;border-radius:8px;margin-top:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:12px;color:#7a7260;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">
                      No payment was made for this booking, so no refund is due.
                    </p>
                  </td>
                </tr>
              </table>
              `
              }

              <!-- WhatsApp CTA -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                <tr>
                  <td style="background:#c9a84c;border-radius:6px;padding:12px 28px;">
                    <a href="https://wa.me/919448433125" style="font-size:13px;color:#0d2b22;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Contact Us on WhatsApp</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background:linear-gradient(160deg,#0d2b22 0%,#1a4035 100%);border-radius:0 0 12px 12px;padding:28px 40px;">
              <p style="margin:0 0 8px;font-family:'Georgia',serif;font-size:16px;color:#f5f0e8;">Prathibhimba Lakeside Retreat</p>
              <p style="margin:0 0 4px;font-size:12px;color:#7aaa98;font-family:Helvetica,Arial,sans-serif;">Madikeri, Coorg, Karnataka</p>
              <p style="margin:12px 0 0;font-size:11px;color:#3a5a50;font-family:Helvetica,Arial,sans-serif;">This is an automated notification. Please do not reply to this email.</p>
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

// ─── Exports ──────────────────────────────────────────────────────────────────

export async function sendConfirmationMailToGuest(booking) {
  await resend.emails.send({
    from: mailFromGuest,
    to: booking.guest.email,
    subject: `Booking Confirmed – Prathibhimba (#${booking._id})`,
    html: buildEmailHtml(booking),
  });
}

export async function sendConfirmationMailToAdmin(booking) {
  await resend.emails.send({
    from: mailFromBookings,
    to: adminEmail,
    subject: `New Booking: ${booking.guest.name} – ₹${booking.totalAmount}`,
    html: buildAdminEmailHtml(booking),
  });
}

export async function sendPaymentFailedMailToGuest(booking) {
  await resend.emails.send({
    from: mailFromGuest,
    to: booking.guest.email,
    subject: `Payment Failed – Prathibhimba Booking`,
    html: buildPaymentFailedHtml(booking),
  });
}

export const sendAdminOTPEmail = async (email, otp) => {
  const { data, error } = await resend.emails.send({
    from: mailFromGuest,
    to: [email],
    reply_to: adminEmail,
    subject: "Your Admin Login OTP – Prathibhimba",
    html: buildAdminOTPHtml(otp),
  });

  if (error) {
    throw new Error(error.message || "Failed to send OTP email");
  }
};

export async function sendCancellationMailToGuest(booking) {
  await resend.emails.send({
    from: mailFromGuest,
    to: booking.guest.email,
    subject: `Booking Cancelled – Prathibhimba (#${booking._id})`,
    html: buildCancellationHtml(booking),
  });
}
