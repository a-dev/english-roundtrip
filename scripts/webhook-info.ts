import { callTelegram } from './telegram';

/** The subset of Telegram's `getWebhookInfo` response we report on. */
export interface WebhookInfo {
  url: string;
  pending_update_count: number;
  allowed_updates?: string[];
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
}

export function getWebhookInfo(): Promise<WebhookInfo> {
  return callTelegram<WebhookInfo>('getWebhookInfo');
}

/** Human-readable summary for verifying a webhook after set/delete. */
export function formatWebhookInfo(info: WebhookInfo): string {
  const lines = [
    `URL:             ${info.url.length > 0 ? info.url : '(none)'}`,
    `Pending updates: ${info.pending_update_count}`,
    `Allowed updates: ${info.allowed_updates?.join(', ') ?? '(default set)'}`,
  ];
  if (info.last_error_date !== undefined) {
    const when = new Date(info.last_error_date * 1000).toISOString();
    lines.push(`Last error:      ${when} — ${info.last_error_message ?? '(no message)'}`);
  } else {
    lines.push('Last error:      none');
  }
  return lines.join('\n');
}

// Run directly to check the current webhook: `bun scripts/webhook-info.ts`.
if (import.meta.main) {
  console.log(formatWebhookInfo(await getWebhookInfo()));
}
