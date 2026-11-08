import NextLink from "next/link"

/**
 * The app's link: like next/link, but pages are NOT pre-loaded in the background.
 * Every page here is dynamic (it reads the database), so Next's default prefetch fired one
 * server request + database query per visible link — ~40 per home-page view. On the free
 * Vercel/Neon plans that is pure waste (and members' mobile data). A link now loads on tap.
 * Pass prefetch={true} only where a background load is really worth it.
 */
export default function Link({ prefetch = false, ...props }: React.ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />
}
