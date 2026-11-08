"use server"

import { revalidatePath } from "next/cache"
import { activeMemberIds, notifyLater } from "@/lib/notify"
import { z } from "zod"
import { adminAction, type ActionResult } from "@/lib/actions"
import { getDb } from "@/lib/db"
import { createNotice, setNoticeStatus } from "@/lib/services/notices"
import { formObject, idParam, reqText } from "@/lib/validation"

type State<T> = ActionResult<T> | undefined

export async function createNoticeAction(_: State<null>, fd: FormData) {
  return adminAction(async (admin) => {
    const { title, body } = z.object({ title: reqText(200, "শিরোনাম লিখুন।"), body: reqText(5000, "লেখা দিন।") }).parse(formObject(fd))
    const n = await createNotice(getDb(), admin.id, title, body)
    notifyLater(async (db) =>
      (await activeMemberIds(db)).map((id) => ({ memberId: id, kind: "notice" as const, title: `নোটিশ: ${n.title}`, body: n.body.slice(0, 180), url: "/notices" })),
    )
    revalidatePath("/", "layout")
    return null
  })
}

export async function setNoticeStatusAction(_: State<null>, fd: FormData) {
  return adminAction(async (admin) => {
    const { id, status } = z.object({ id: idParam, status: z.enum(["active", "archived"]) }).parse(formObject(fd))
    await setNoticeStatus(getDb(), admin.id, id, status)
    revalidatePath("/", "layout")
    return null
  })
}
