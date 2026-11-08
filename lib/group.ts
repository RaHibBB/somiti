import "server-only"

/**
 * The samiti's WhatsApp group invite link, from the WHATSAPP_GROUP_URL environment variable.
 * Not committed: anyone with the link can join, and this repository is public. Shown only to
 * logged-in members. Returns null when unset or not a WhatsApp invite link.
 */
export function getGroupUrl(): string | null {
  const url = process.env.WHATSAPP_GROUP_URL?.trim()
  return url && /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/.test(url) ? url : null
}
