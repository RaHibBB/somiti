"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminAction } from "@/lib/actions"
import { getDb } from "@/lib/db"
import { createInvites, type Invite } from "@/lib/services/invites"

const schema = z.object({
  memberIds: z.array(z.number().int().positive()).min(1, "অন্তত একজন সদস্য বাছাই করুন।").max(200),
})

/** Admin only. The response carries the plaintext passwords once, for sending; nothing keeps them. */
export async function createInvitesAction(input: z.input<typeof schema>) {
  return adminAction<{ invites: Invite[]; skipped: number }>(async (admin) => {
    const { memberIds } = schema.parse(input)
    const result = await createInvites(getDb(), admin.id, memberIds)
    revalidatePath("/admin/invite")
    return result
  })
}
