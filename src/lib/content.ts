export type Link = {
  label?: string
  url?: string
}

export type Project = {
  name?: string
  desc?: string
  link?: string
  stack?: string[]
}

export type SiteData = {
  name?: string
  role?: string
  location?: string
  status?: string
  email?: string
  resume_link?: string
  links?: Link[]
  tech?: Record<string, string>
  projects?: Project[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === 'string')
}

const asStringRecord = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
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

const parseProject = (value: unknown): Project | undefined => {
  if (!isRecord(value)) return undefined
  const name = asString(value.name)
  const desc = asString(value.desc)
  const link = asString(value.link)
  const stack = asStringArray(value.stack)
  if (!name && !desc && !link && !stack?.length) return undefined
  return { name, desc, link, stack }
}

export const parseSiteData = (value: unknown): SiteData | null => {
  if (!isRecord(value)) return null
  return {
    name: asString(value.name),
    role: asString(value.role),
    location: asString(value.location),
    status: asString(value.status),
    email: asString(value.email),
    resume_link: asString(value.resume_link),
    links: asArray(value.links, parseLink),
    tech: asStringRecord(value.tech),
    projects: asArray(value.projects, parseProject)
  }
}

