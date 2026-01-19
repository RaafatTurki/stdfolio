import { parsePostsData, parseSiteData, type PostsResponse, type SiteData } from '$lib/content'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ fetch }) => {
  const [siteRes, postsRes] = await Promise.all([
    fetch('/data/site.json'),
    fetch('/data/posts.json')
  ])

  const site: SiteData | null = siteRes.ok ? parseSiteData(await siteRes.json()) : null
  const posts: PostsResponse = postsRes.ok ? parsePostsData(await postsRes.json()) : { posts: [] }

  return { site, posts }
}
