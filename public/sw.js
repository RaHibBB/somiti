// Service worker: shows the samiti's push notifications and opens the right page when tapped.
// Plain JS on purpose (served as-is from /sw.js). No offline caching: the accounts must always be fresh.

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: "সমিতি", body: event.data ? event.data.text() : "" }
  }
  const title = data.title || "পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি"
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/app-icon/192",
      badge: "/app-icon/192",
      tag: data.tag,
      lang: "bn",
      data: { url: data.url || "/notifications" },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || "/notifications", self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const w of windows) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          await w.focus()
          if ("navigate" in w) await w.navigate(url)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
