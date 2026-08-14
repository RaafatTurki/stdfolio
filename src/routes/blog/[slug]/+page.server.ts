import { error } from '@sveltejs/kit'
import { getPost, getPosts } from '$lib/server/posts'
import type {
  EntryGenerator,
  PageServerLoad
} from './$types'

export const prerender = true

export const entries: EntryGenerator = () => {
  return getPosts().map((post) => ({
    slug: post.slug
  }))
}

export const load: PageServerLoad = ({ params }) => {
  const post = getPost(params.slug)

  if (!post) {
    error(404, 'Post not found')
  }

  return {
    post
  }
}
