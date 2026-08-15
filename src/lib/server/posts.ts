import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'

const POSTS_DIR = path.resolve('static/posts')

const marked = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    }
  })
)

marked.setOptions({
  gfm: true,
  breaks: false
})

export type PostSummary = {
  slug: string
  name: string
  date: string
  desc: string
}

export type Post = PostSummary & {
  content: string
  html: string
}

function findPostFile(slug: string): string | null {
  const extensions = ['.md', '.txt']
  for (const ext of extensions) {
    const candidate = path.join(POSTS_DIR, `${slug}${ext}`)
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

export function getPosts(): PostSummary[] {
  if (!fs.existsSync(POSTS_DIR)) {
    return []
  }

  const seenSlugs = new Set<string>()
  const summaries: PostSummary[] = []

  const files = fs.readdirSync(POSTS_DIR)
  for (const filename of files) {
    if (!filename.endsWith('.txt') && !filename.endsWith('.md')) {
      continue
    }

    const slug = filename.replace(/\.(txt|md)$/, '')
    if (seenSlugs.has(slug)) continue
    seenSlugs.add(slug)

    const filepath = path.join(POSTS_DIR, filename)
    const raw = fs.readFileSync(filepath, 'utf-8')
    const { data } = matter(raw)

    summaries.push({
      slug,
      name: String(data.name ?? slug),
      date: String(data.date ?? ''),
      desc: String(data.desc ?? '')
    })
  }

  return summaries.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })
}

export function getPost(slug: string): Post | null {
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return null
  }

  const filepath = findPostFile(slug)
  if (!filepath) {
    return null
  }

  const raw = fs.readFileSync(filepath, 'utf-8')
  const { data, content } = matter(raw)
  const html = marked.parse(content) as string

  return {
    slug,
    name: String(data.name ?? slug),
    date: String(data.date ?? ''),
    desc: String(data.desc ?? ''),
    content,
    html
  }
}
