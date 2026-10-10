"use client"

import { Field } from "@/components/forms/form-bits"
import { NativeSelect } from "@/components/forms/native-select"

export type Receiver = { id: number; name: string }

/** "Who holds this money?" — the admin who took it (may differ from the admin typing it in). */
export function ReceiverSelect({
  receivers,
  value,
  onChange,
  meId,
}: {
  receivers: Receiver[]
  value: number
  onChange: (id: number) => void
  meId: number
}) {
  return (
    <Field label="টাকা কার কাছে জমা আছে?" htmlFor="receivedBy" hint="অন্য কোনো অ্যাডমিন টাকা নিয়ে থাকলে তাঁকে বাছুন। না হলে নিজের নামই থাকবে।">
      <NativeSelect id="receivedBy" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {receivers.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.id === meId ? " (আমি)" : ""}
          </option>
        ))}
      </NativeSelect>
    </Field>
  )
}
