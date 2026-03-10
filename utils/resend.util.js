import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
      return `
        <div style="background:#faf8f4;border:1px solid #e8e0d0;border-radius:8px;padding:20px 24px;margin-bottom:16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <p style="margin:0 0 4px 0;font-family:'Georgia',serif;font-size:17px;color:#2c2416;font-weight:bold;">${roomLabel}</p>
                <p style="margin:0;font-size:13px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">
                  ${formatDate(room.checkIn)} &rarr; ${formatDate(room.checkOut)} &nbsp;&middot;&nbsp; ${nights} night${nights !== 1 ? "s" : ""}
                </p>
                <p style="margin:4px 0 0 0;font-size:13px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">
                  ${room.adults} Adult${room.adults !== 1 ? "s" : ""}${room.children > 0 ? ` &middot; ${room.children} Child${room.children !== 1 ? "ren" : ""}` : ""}
                </p>
              </td>
              <td align="right" valign="top">
                <p style="margin:0;font-family:'Georgia',serif;font-size:18px;color:#c8973a;font-weight:bold;">&#8377;${room.price.toLocaleString("en-IN")}</p>
              </td>
            </tr>
          </table>
        </div>
      `;
    })
    .join("");
}

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
  <title>Booking Confirmation – Summer Green</title>
</head>
<body style="margin:0;padding:0;background-color:#f0ebe1;font-family:Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0ebe1;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="background:linear-gradient(160deg,#1a1408 0%,#2c2416 60%,#3a2e18 100%);border-radius:12px 12px 0 0;padding:48px 40px 36px;">
              <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:4px;color:#c8973a;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Homestay Experience</p>
              <h1 style="margin:0;font-family:'Georgia',serif;font-size:42px;color:#f5f0e8;font-weight:normal;letter-spacing:1px;">Summer Green</h1>
              <div style="width:48px;height:2px;background:#c8973a;margin:16px auto 24px;"></div>
              <p style="margin:0;font-size:13px;color:#a89878;font-family:Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;">Madikeri, Coorg</p>
            </td>
          </tr>

          <!-- Confirmed Banner -->
          <tr>
            <td align="center" style="background:#c8973a;padding:14px 40px;">
              <p style="margin:0;font-size:12px;letter-spacing:3px;color:#1a1408;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">&#10003; &nbsp; Booking Confirmed</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;">

              <p style="margin:0 0 8px 0;font-family:'Georgia',serif;font-size:22px;color:#2c2416;">Dear ${booking.guest.name},</p>
              <p style="margin:0 0 28px 0;font-size:14px;color:#6b5f4a;line-height:1.7;">
                Thank you for choosing Summer Green. We're delighted to confirm your reservation and look forward to welcoming you to our home in the hills of Coorg.
              </p>

              <!-- Booking Reference -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf8f4;border:1px solid #e8e0d0;border-radius:8px;padding:0;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 24px;border-bottom:1px solid #e8e0d0;">
                    <p style="margin:0;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Booking Reference</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Booking ID</span>
                        </td>
                        <td align="right" style="padding:4px 0;">
                          <span style="font-size:12px;color:#2c2416;font-family:'Courier New',monospace;font-weight:bold;">${booking._id}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Payment ID</span>
                        </td>
                        <td align="right" style="padding:4px 0;">
                          <span style="font-size:12px;color:#2c2416;font-family:'Courier New',monospace;">${booking.razorpayPaymentId || "—"}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Booked on</span>
                        </td>
                        <td align="right" style="padding:4px 0;">
                          <span style="font-size:12px;color:#2c2416;font-family:Helvetica,Arial,sans-serif;">${bookingDate}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Guest Details -->
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Guest Details</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf8f4;border:1px solid #e8e0d0;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:4px 0;width:40%;">
                          <span style="font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Name</span>
                        </td>
                        <td align="right" style="padding:4px 0;">
                          <span style="font-size:12px;color:#2c2416;font-family:Helvetica,Arial,sans-serif;">${booking.guest.name}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Email</span>
                        </td>
                        <td align="right" style="padding:4px 0;">
                          <span style="font-size:12px;color:#2c2416;font-family:Helvetica,Arial,sans-serif;">${booking.guest.email}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Phone</span>
                        </td>
                        <td align="right" style="padding:4px 0;">
                          <span style="font-size:12px;color:#2c2416;font-family:Helvetica,Arial,sans-serif;">${booking.guest.phone}</span>
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
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #c8973a;margin-top:8px;padding-top:16px;">
                <tr>
                  <td>
                    <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:#2c2416;">Total Amount</p>
                  </td>
                  <td align="right">
                    <p style="margin:0;font-family:'Georgia',serif;font-size:22px;color:#c8973a;font-weight:bold;">&#8377;${booking.totalAmount.toLocaleString("en-IN")}</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin:4px 0 0;font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Amount Paid</p>
                  </td>
                  <td align="right">
                    <p style="margin:4px 0 0;font-size:12px;color:#5a8a5a;font-family:Helvetica,Arial,sans-serif;">&#8377;${booking.amountPaid.toLocaleString("en-IN")} &#10003;</p>
                  </td>
                </tr>
                ${
                  booking.totalAmount - booking.amountPaid > 0
                    ? `
                <tr>
                  <td>
                    <p style="margin:4px 0 0;font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Balance due on arrival</p>
                  </td>
                  <td align="right">
                    <p style="margin:4px 0 0;font-size:12px;color:#c8693a;font-family:Helvetica,Arial,sans-serif;">&#8377;${(booking.totalAmount - booking.amountPaid).toLocaleString("en-IN")}</p>
                  </td>
                </tr>`
                    : ""
                }
              </table>

            </td>
          </tr>

          <!-- Info Strip -->
          <tr>
            <td style="background:#faf8f4;border:1px solid #e8e0d0;border-top:none;padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="33%" align="center" style="padding:8px;">
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Check-in</p>
                    <p style="margin:0;font-family:'Georgia',serif;font-size:14px;color:#2c2416;">From 14:00</p>
                  </td>
                  <td width="1" style="background:#e8e0d0;">&nbsp;</td>
                  <td width="33%" align="center" style="padding:8px;">
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Check-out</p>
                    <p style="margin:0;font-family:'Georgia',serif;font-size:14px;color:#2c2416;">By 11:00</p>
                  </td>
                  <td width="1" style="background:#e8e0d0;">&nbsp;</td>
                  <td width="33%" align="center" style="padding:8px;">
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">WhatsApp</p>
                    <p style="margin:0;font-family:'Georgia',serif;font-size:14px;color:#2c2416;">+91 90081 88595</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cancellation Note -->
          <tr>
            <td style="background:#fff8ee;border:1px solid #e8d9b0;border-top:none;padding:16px 40px;">
              <p style="margin:0;font-size:12px;color:#8a6a2a;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">
                <strong>Cancellation Policy:</strong> 100% refund if cancelled 15+ days before check-in. No refund after that. Cancellations must be requested via admin.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background:#2c2416;border-radius:0 0 12px 12px;padding:28px 40px;">
              <p style="margin:0 0 8px;font-family:'Georgia',serif;font-size:16px;color:#f5f0e8;">Summer Green Homestay</p>
              <p style="margin:0 0 4px;font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Madikeri, Coorg, Karnataka</p>
              <p style="margin:12px 0 0;font-size:11px;color:#5a4f3a;font-family:Helvetica,Arial,sans-serif;">This is an automated confirmation. Please do not reply to this email.</p>
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

function buildAdminEmailHtml(booking) {
  const roomsHtml = buildRoomsHtml(booking.rooms);
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>New Booking – Admin</title></head>
<body style="margin:0;padding:0;background:#f0ebe1;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0ebe1;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background:#1a1408;border-radius:12px 12px 0 0;padding:28px 40px;">
              <p style="margin:0;font-family:'Georgia',serif;font-size:24px;color:#f5f0e8;">&#128bell; New Booking Received</p>
              <p style="margin:6px 0 0;font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Summer Green Admin Notification</p>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px 40px;">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;">Guest</p>
              <p style="margin:0 0 20px;font-family:'Georgia',serif;font-size:20px;color:#2c2416;">${booking.guest.name}</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf8f4;border:1px solid #e8e0d0;border-radius:8px;margin-bottom:24px;">
                <tr><td style="padding:16px 24px;">
                  <table width="100%" cellpadding="4" cellspacing="0" border="0">
                    <tr><td style="font-size:12px;color:#8a7a5a;">Email</td><td align="right" style="font-size:12px;color:#2c2416;">${booking.guest.email}</td></tr>
                    <tr><td style="font-size:12px;color:#8a7a5a;">Phone</td><td align="right" style="font-size:12px;color:#2c2416;">${booking.guest.phone}</td></tr>
                    <tr><td style="font-size:12px;color:#8a7a5a;">Booking ID</td><td align="right" style="font-size:12px;color:#2c2416;font-family:'Courier New',monospace;">${booking._id}</td></tr>
                    <tr><td style="font-size:12px;color:#8a7a5a;">Razorpay Order</td><td align="right" style="font-size:12px;color:#2c2416;font-family:'Courier New',monospace;">${booking.razorpayOrderId}</td></tr>
                    <tr><td style="font-size:12px;color:#8a7a5a;">Payment ID</td><td align="right" style="font-size:12px;color:#2c2416;font-family:'Courier New',monospace;">${booking.razorpayPaymentId || "—"}</td></tr>
                    <tr><td style="font-size:12px;color:#8a7a5a;">Amount Paid</td><td align="right" style="font-size:13px;color:#5a8a5a;font-weight:bold;">&#8377;${booking.amountPaid.toLocaleString("en-IN")}</td></tr>
                    <tr><td style="font-size:12px;color:#8a7a5a;">Total Amount</td><td align="right" style="font-size:13px;color:#c8973a;font-weight:bold;">&#8377;${booking.totalAmount.toLocaleString("en-IN")}</td></tr>
                  </table>
                </td></tr>
              </table>
              <p style="margin:0 0 12px;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;">Room${booking.rooms.length > 1 ? "s" : ""} Booked</p>
              ${roomsHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#2c2416;border-radius:0 0 12px 12px;padding:20px 40px;">
              <p style="margin:0;font-size:12px;color:#5a4f3a;font-family:Helvetica,Arial,sans-serif;">Summer Green Admin &middot; Automated Notification</p>
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

function buildPaymentFailedHtml(booking) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Payment Failed – Summer Green</title></head>
<body style="margin:0;padding:0;background:#f0ebe1;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0ebe1;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="background:linear-gradient(160deg,#1a1408 0%,#2c2416 100%);border-radius:12px 12px 0 0;padding:48px 40px 36px;">
              <h1 style="margin:0;font-family:'Georgia',serif;font-size:38px;color:#f5f0e8;font-weight:normal;">Summer Green</h1>
              <div style="width:48px;height:2px;background:#c8693a;margin:16px auto 0;"></div>
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#c8693a;padding:14px 40px;">
              <p style="margin:0;font-size:12px;letter-spacing:3px;color:#fff;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">&#9888; Payment Unsuccessful</p>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:40px;">
              <p style="margin:0 0 16px;font-family:'Georgia',serif;font-size:20px;color:#2c2416;">Dear ${booking.guest.name},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#6b5f4a;line-height:1.7;">
                We're sorry — your payment for the booking at Summer Green could not be processed. Your reservation is still pending and has <strong>not</strong> been confirmed.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf8f4;border:1px solid #e8e0d0;border-radius:8px;margin-bottom:24px;">
                <tr><td style="padding:16px 24px;">
                  <table width="100%" cellpadding="4" cellspacing="0" border="0">
                    <tr><td style="font-size:12px;color:#8a7a5a;">Booking ID</td><td align="right" style="font-size:12px;font-family:'Courier New',monospace;color:#2c2416;">${booking._id}</td></tr>
                    <tr><td style="font-size:12px;color:#8a7a5a;">Amount</td><td align="right" style="font-size:13px;color:#c8973a;font-weight:bold;">&#8377;${booking.totalAmount.toLocaleString("en-IN")}</td></tr>
                  </table>
                </td></tr>
              </table>
              <p style="margin:0 0 8px;font-size:14px;color:#6b5f4a;line-height:1.7;">Please try again or contact us on WhatsApp and we'll help you complete your booking.</p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                <tr>
                  <td style="background:#c8973a;border-radius:6px;padding:12px 28px;">
                    <a href="https://wa.me/919008188595" style="font-size:13px;color:#1a1408;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Contact Us on WhatsApp</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#2c2416;border-radius:0 0 12px 12px;padding:24px 40px;">
              <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:#f5f0e8;">Summer Green Homestay</p>
              <p style="margin:6px 0 0;font-size:12px;color:#5a4f3a;font-family:Helvetica,Arial,sans-serif;">Madikeri, Coorg, Karnataka</p>
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
  await resend.emails.send({
    from: "Summer Green <bookings@summergreen.in>", // replace with your verified domain
    to: booking.guest.email,
    subject: `Booking Confirmed – Summer Green (#${booking._id})`,
    html: buildEmailHtml(booking),
  });
}

export async function sendConfirmationMailToAdmin(booking) {
  await resend.emails.send({
    from: "Summer Green Bookings <bookings@summergreen.in>",
    to: "dineshkumarmercara@gmail.com", // replace with your admin email
    subject: `New Booking: ${booking.guest.name} – ₹${booking.totalAmount}`,
    html: buildAdminEmailHtml(booking),
  });
}

export async function sendPaymentFailedMailToGuest(booking) {
  await resend.emails.send({
    from: "Summer Green <bookings@summergreen.in>",
    to: booking.guest.email,
    subject: `Payment Failed – Summer Green Booking`,
    html: buildPaymentFailedHtml(booking),
  });
}

export const sendAdminOTPEmail = async (email, otp) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Admin Login – Summer Green</title>
</head>
<body style="margin:0;padding:0;background-color:#f0ebe1;font-family:Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0ebe1;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="background:linear-gradient(160deg,#1a1408 0%,#2c2416 60%,#3a2e18 100%);border-radius:12px 12px 0 0;padding:40px 40px 32px;">
              <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:4px;color:#c8973a;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Homestay Experience</p>
              <h1 style="margin:0;font-family:'Georgia',serif;font-size:36px;color:#f5f0e8;font-weight:normal;letter-spacing:1px;">Summer Green</h1>
              <div style="width:40px;height:2px;background:#c8973a;margin:14px auto 0;"></div>
            </td>
          </tr>

          <!-- Banner -->
          <tr>
            <td align="center" style="background:#c8973a;padding:12px 40px;">
              <p style="margin:0;font-size:11px;letter-spacing:3px;color:#1a1408;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">&#128274; &nbsp; Admin Login Verification</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 36px;">
              <p style="margin:0 0 8px;font-family:'Georgia',serif;font-size:20px;color:#2c2416;">Hello, Admin</p>
              <p style="margin:0 0 32px;font-size:14px;color:#6b5f4a;line-height:1.7;">
                A login attempt was made to the Summer Green admin panel. Use the OTP below to complete verification. Do not share this code with anyone.
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:#faf8f4;border:1px solid #e8e0d0;border-top:3px solid #c8973a;border-radius:8px;padding:28px 48px;margin-bottom:28px;">
                      <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Your One-Time Password</p>
                      <p style="margin:0;font-family:'Courier New',monospace;font-size:40px;font-weight:bold;letter-spacing:12px;color:#c8973a;">${otp}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff8ee;border:1px solid #e8d9b0;border-radius:8px;margin-bottom:8px;">
                <tr>
                  <td style="padding:14px 20px;">
                    <p style="margin:0;font-size:12px;color:#8a6a2a;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">
                      &#9888;&nbsp; This OTP is valid for <strong>5 minutes</strong>. If you did not request this, please ignore this email and secure your account.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background:#2c2416;border-radius:0 0 12px 12px;padding:24px 40px;">
              <p style="margin:0 0 4px;font-family:'Georgia',serif;font-size:15px;color:#f5f0e8;">Summer Green Homestay</p>
              <p style="margin:0 0 8px;font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Madikeri, Coorg, Karnataka</p>
              <p style="margin:0;font-size:11px;color:#5a4f3a;font-family:Helvetica,Arial,sans-serif;">bookings@summergreen.in</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `;

  const { data, error } = await resend.emails.send({
    from: "Summer Green <bookings@summergreen.in>",
    to: [email],
    reply_to: "bookings@summergreen.in",
    subject: "Your Admin Login OTP – Summer Green",
    html,
  });

  if (error) {
    throw new Error(error.message || "Failed to send OTP email");
  }
};

function buildCancellationHtml(booking) {
  const roomsHtml = (booking.rooms || [])
    .map(function (room) {
      const nights = Math.round(
        (new Date(room.checkOut) - new Date(room.checkIn)) /
          (1000 * 60 * 60 * 24)
      );
      const roomLabel = room.roomName || room.roomId;
      return `
        <div style="background:#faf8f4;border:1px solid #e8e0d0;border-radius:8px;padding:20px 24px;margin-bottom:16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <p style="margin:0 0 4px 0;font-family:'Georgia',serif;font-size:17px;color:#2c2416;font-weight:bold;">${roomLabel}</p>
                <p style="margin:0;font-size:13px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">
                  ${new Date(room.checkIn).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
                  &rarr;
                  ${new Date(room.checkOut).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
                  &nbsp;&middot;&nbsp; ${nights} night${nights !== 1 ? "s" : ""}
                </p>
                <p style="margin:4px 0 0;font-size:13px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">
                  ${room.adults} Adult${room.adults !== 1 ? "s" : ""}${room.children > 0 ? ` &middot; ${room.children} Child${room.children !== 1 ? "ren" : ""}` : ""}
                </p>
              </td>
              <td align="right" valign="top">
                <p style="margin:0;font-family:'Georgia',serif;font-size:17px;color:#8a7a5a;text-decoration:line-through;">&#8377;${room.price.toLocaleString("en-IN")}</p>
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
  <title>Booking Cancelled – Summer Green</title>
</head>
<body style="margin:0;padding:0;background-color:#f0ebe1;font-family:Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0ebe1;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="background:linear-gradient(160deg,#1a1408 0%,#2c2416 60%,#3a2e18 100%);border-radius:12px 12px 0 0;padding:48px 40px 36px;">
              <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:4px;color:#c8973a;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Homestay Experience</p>
              <h1 style="margin:0;font-family:'Georgia',serif;font-size:42px;color:#f5f0e8;font-weight:normal;letter-spacing:1px;">Summer Green</h1>
              <div style="width:48px;height:2px;background:#c8973a;margin:16px auto 24px;"></div>
              <p style="margin:0;font-size:13px;color:#a89878;font-family:Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;">Madikeri, Coorg</p>
            </td>
          </tr>

          <!-- Cancelled Banner -->
          <tr>
            <td align="center" style="background:#8a4a3a;padding:14px 40px;">
              <p style="margin:0;font-size:12px;letter-spacing:3px;color:#fff;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;font-weight:bold;">&#10005; &nbsp; Booking Cancelled</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;">

              <p style="margin:0 0 8px 0;font-family:'Georgia',serif;font-size:22px;color:#2c2416;">Dear ${booking.guest.name},</p>
              <p style="margin:0 0 28px 0;font-size:14px;color:#6b5f4a;line-height:1.7;">
                We're sorry to inform you that your booking at Summer Green has been cancelled as of <strong>${cancellationDate}</strong>. We hope to welcome you another time.
              </p>

              <!-- Booking Reference -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf8f4;border:1px solid #e8e0d0;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 24px;border-bottom:1px solid #e8e0d0;">
                    <p style="margin:0;font-size:11px;letter-spacing:2px;color:#a89878;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">Cancellation Details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px;">
                    <table width="100%" cellpadding="4" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Booking ID</td>
                        <td align="right" style="font-size:12px;color:#2c2416;font-family:'Courier New',monospace;font-weight:bold;">${booking._id}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Cancelled on</td>
                        <td align="right" style="font-size:12px;color:#2c2416;font-family:Helvetica,Arial,sans-serif;">${cancellationDate}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Total Amount</td>
                        <td align="right" style="font-size:12px;color:#2c2416;font-family:Helvetica,Arial,sans-serif;">&#8377;${booking.totalAmount.toLocaleString("en-IN")}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Amount Paid</td>
                        <td align="right" style="font-size:13px;color:${isEligibleForRefund ? "#8a4a3a" : "#2c2416"};font-family:Helvetica,Arial,sans-serif;font-weight:bold;">&#8377;${booking.amountPaid.toLocaleString("en-IN")}</td>
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
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff8ee;border:1px solid #e8d9b0;border-radius:8px;margin-top:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;color:#8a6a2a;font-weight:bold;font-family:Helvetica,Arial,sans-serif;">Refund Information</p>
                    <p style="margin:0;font-size:12px;color:#8a6a2a;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">
                      A payment of <strong>&#8377;${booking.amountPaid.toLocaleString("en-IN")}</strong> was made on this booking.
                      As per our cancellation policy, refunds are applicable only if cancelled 15+ days before check-in.
                      Please contact us on WhatsApp for refund queries.
                    </p>
                  </td>
                </tr>
              </table>
              `
                  : `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf8f4;border:1px solid #e8e0d0;border-radius:8px;margin-top:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:12px;color:#8a7a5a;line-height:1.6;font-family:Helvetica,Arial,sans-serif;">
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
                  <td style="background:#c8973a;border-radius:6px;padding:12px 28px;">
                    <a href="https://wa.me/919008188595" style="font-size:13px;color:#1a1408;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Contact Us on WhatsApp</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background:#2c2416;border-radius:0 0 12px 12px;padding:28px 40px;">
              <p style="margin:0 0 8px;font-family:'Georgia',serif;font-size:16px;color:#f5f0e8;">Summer Green Homestay</p>
              <p style="margin:0 0 4px;font-size:12px;color:#8a7a5a;font-family:Helvetica,Arial,sans-serif;">Madikeri, Coorg, Karnataka</p>
              <p style="margin:12px 0 0;font-size:11px;color:#5a4f3a;font-family:Helvetica,Arial,sans-serif;">This is an automated notification. Please do not reply to this email.</p>
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

export async function sendCancellationMailToGuest(booking) {
  await resend.emails.send({
    from: "Summer Green <bookings@summergreen.in>",
    to: booking.guest.email,
    subject: `Booking Cancelled – Summer Green (#${booking._id})`,
    html: buildCancellationHtml(booking),
  });
}
