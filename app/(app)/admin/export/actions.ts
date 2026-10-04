"use server"

import { adminAction } from "@/lib/actions"
import { getDb } from "@/lib/db"
import { UserError } from "@/lib/services/errors"
import { fullRewrite, googleTarget } from "@/lib/sheets/sync"

export async function rewriteSheetAction() {
  return adminAction(async () => {
    const target = await googleTarget()
    if (!target) throw new UserError("Google Sheet এখনো সেটআপ করা হয়নি (GOOGLE_SERVICE_ACCOUNT_JSON, SHEET_ID)।")
    await fullRewrite(getDb(), target)
    return null
  })
}
