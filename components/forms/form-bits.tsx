"use client"

import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function SubmitButton({
  children,
  pendingText = "অপেক্ষা করুন…",
  className,
  variant,
}: {
  children: React.ReactNode
  pendingText?: string
  className?: string
  variant?: "default" | "destructive" | "outline"
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="xl" variant={variant} disabled={pending} className={className}>
      {pending ? (
        <>
          <Loader2 className="size-5 animate-spin" /> {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  )
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-base text-destructive">
      {message}
    </p>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
