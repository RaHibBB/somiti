import "server-only"

// Free email via any SMTP account, e.g. a Gmail address with an App Password
// (SMTP_HOST=smtp.gmail.com, SMTP_PORT=465). Without SMTP settings in development,
// the message is printed to the server console instead.

export type Mail = { to: string; subject: string; text: string; html?: string }

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

export async function sendMail(mail: Mail): Promise<void> {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP is not configured")
    console.log(`\n── [dev mail] to ${mail.to} ──\nSubject: ${mail.subject}\n${mail.text}\n──────────────\n`)
    return
  }
  const nodemailer = await import("nodemailer")
  const port = Number(process.env.SMTP_PORT ?? 465)
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  })
}
