// Sends sign-in codes through Resend's HTTP API (https://resend.com).
// Configure RESEND_API_KEY and EMAIL_FROM (a verified sender) as secrets.

export async function sendCodeEmail(
  apiKey: string,
  from: string,
  to: string,
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const res = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: `Your sign-in code: ${code}`,
      text: `Your Botanical & You sign-in code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask for this, you can ignore this email.`,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return !!res?.ok;
}
