import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const POSTS_DIR = path.resolve('static/posts')

export type PostSummary = {
  slug: string
  name: string
  date: string
  desc: string
}

export type Post = PostSummary & {
  content: string
}

export function getPosts(): PostSummary[] {
  if (!fs.existsSync(POSTS_DIR)) {
    return []
  }

  return fs
    .readdirSync(POSTS_DIR)
    .filter((filename) => filename.endsWith('.txt'))
    .map((filename) => {
      const slug = path.basename(filename, '.txt')
      const filepath = path.join(POSTS_DIR, filename)
      const raw = fs.readFileSync(filepath, 'utf-8')
      const { data } = matter(raw)

      return {
        slug,
        name: String(data.name ?? slug),
        date: String(data.date ?? ''),
        desc: String(data.desc ?? '')
      }
    })
    .sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
}

export function getPost(slug: string): Post | null {
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return null
  }

  const filepath = path.join(POSTS_DIR, `${slug}.txt`)

  if (!fs.existsSync(filepath)) {
    return null
  }

  const raw = fs.readFileSync(filepath, 'utf-8')
  const { data, content } = matter(raw)

  return {
    slug,
    name: String(data.name ?? slug),
    date: String(data.date ?? ''),
    desc: String(data.desc ?? ''),
    content
  }
}
