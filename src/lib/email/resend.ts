import { Resend } from "resend";

let client: Resend | null = null;

function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is not configured. Set it in the environment to enable report delivery."
    );
  }
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

function getFrom(): string {
  const from = process.env.RESEND_FROM;
  if (!from) {
    throw new Error(
      "RESEND_FROM is not configured. Set a verified sender address."
    );
  }
  return from;
}

/**
 * Send an email with an optional PDF attachment via Resend.
 * Returns the provider message id on success.
 */
export async function sendEmailWithPdf(opts: {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  pdfBuffer?: Buffer;
  filename?: string;
}): Promise<string> {
  const resend = getResend();
  const from = getFrom();

  const attachments = opts.pdfBuffer
    ? [
        {
          filename: opts.filename ?? "report.pdf",
          content: opts.pdfBuffer,
        },
      ]
    : undefined;

  const { data, error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments,
  });
  if (error) {
    throw new Error(`Resend delivery failed: ${error.message ?? "unknown"}`);
  }
  return data?.id ?? "";
}

/** Build a minimal, brand-neutral HTML body for the monthly report email. */
export function buildMonthlyReportEmailHtml(opts: {
  clientName: string;
  reportMonthLabel: string;
  channelCount: number;
}): string {
  return `
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #0f172a; background: #f8fafc; margin: 0; padding: 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 24px;">
          <div style="font-size: 11px; letter-spacing: 2px; color: #4f46e5; text-transform: uppercase;">6-Month Analytics Report</div>
          <h1 style="font-size: 22px; margin: 6px 0 2px; color: #0f172a;">${escapeHtml(opts.clientName)}</h1>
          <div style="color: #64748b; font-size: 14px;">${escapeHtml(opts.reportMonthLabel)}</div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 14px; line-height: 1.5; color: #0f172a;">
            The monthly performance report for <strong>${escapeHtml(opts.clientName)}</strong> is attached
            as a PDF. It covers six months of YouTube analytics across
            ${opts.channelCount} channel${opts.channelCount === 1 ? "" : "s"},
            with next-month projections and an AI-generated executive summary.
          </p>
          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            This message was generated automatically by your Social Analytics workspace.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
