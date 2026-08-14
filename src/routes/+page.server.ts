import { parseSiteData, type SiteData } from '$lib/content'
import { getPosts } from '$lib/server/posts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ fetch }) => {
  const siteRes = await fetch('/data/site.json')

  const site: SiteData | null = siteRes.ok ? parseSiteData(await siteRes.json()) : null

  return {
    site,
    posts: getPosts()
  }
}
