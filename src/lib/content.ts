export type Link = {
  label?: string
  url?: string
}

export type Stat = {
  label?: string
  value?: string
}

export type Project = {
  name?: string
  status?: string
  stack?: string
  link?: string
}

export type SiteData = {
  name?: string
  role?: string
  location?: string
  status?: string
  email?: string
  links?: Link[]
  stats?: Stat[]
  manifesto?: string[]
  projects?: Project[]
}

export type Post = {
  title?: string
  date?: string
  summary?: string
  link?: string
}

export type PostsResponse = {
  posts: Post[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === 'string')
}

const asArray = <T>(value: unknown, map: (item: unknown) => T | undefined): T[] | undefined => {
  if (!Array.isArray(value)) return undefined
  return value.map(map).filter((item): item is T => item !== undefined)
}

const parseLink = (value: unknown): Link | undefined => {
  if (!isRecord(value)) return undefined
  const label = asString(value.label)
  const url = asString(value.url)
  if (!label && !url) return undefined
  return { label, url }
}

const parseStat = (value: unknown): Stat | undefined => {
  if (!isRecord(value)) return undefined
  const label = asString(value.label)
  const valueText = asString(value.value)
  if (!label && !valueText) return undefined
  return { label, value: valueText }
}

const parseProject = (value: unknown): Project | undefined => {
  if (!isRecord(value)) return undefined
  const name = asString(value.name)
  const status = asString(value.status)
  const stack = asString(value.stack)
  const link = asString(value.link)
  if (!name && !status && !stack && !link) return undefined
  return { name, status, stack, link }
}

const parsePost = (value: unknown): Post | undefined => {
  if (!isRecord(value)) return undefined
  const title = asString(value.title)
  const date = asString(value.date)
  const summary = asString(value.summary)
  const link = asString(value.link)
  if (!title && !date && !summary && !link) return undefined
  return { title, date, summary, link }
}

export const parseSiteData = (value: unknown): SiteData | null => {
  if (!isRecord(value)) return null
  return {
    name: asString(value.name),
    role: asString(value.role),
    location: asString(value.location),
    status: asString(value.status),
    email: asString(value.email),
    links: asArray(value.links, parseLink),
    stats: asArray(value.stats, parseStat),
    manifesto: asStringArray(value.manifesto),
    projects: asArray(value.projects, parseProject)
  }
}

export const parsePostsData = (value: unknown): PostsResponse => {
  if (!isRecord(value)) return { posts: [] }
  return { posts: asArray(value.posts, parsePost) ?? [] }
}
