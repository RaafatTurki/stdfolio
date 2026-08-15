import { getPosts } from '$lib/server/posts'
import type { RequestHandler } from './$types'

export const prerender = true

export const GET: RequestHandler = async () => {
  const posts = getPosts()
  const siteUrl = 'https://raafat.io'

  const items = posts
    .map(
      (post) => `    <item>
      <title><![CDATA[${post.name}]]></title>
      <link>${siteUrl}/blog/${post.slug}/</link>
      <guid isPermaLink="true">${siteUrl}/blog/${post.slug}/</guid>
      <description><![CDATA[${post.desc}]]></description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
    </item>`
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Raafat Turki</title>
    <link>${siteUrl}</link>
    <description>Technical Lead - Senior Backend Engineer</description>
    <language>en</language>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`

  return new Response(xml.trim(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'max-age=0, s-maxage=3600'
    }
  })
}
