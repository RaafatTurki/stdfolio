<script lang="ts">
  import type { PageData } from './$types'
  import { copyToClipboard } from '$lib/clipboard'

  let { data }: { data: PageData } = $props()

  const post = $derived(data.post)

  function enhanceCodeBlocks(node: HTMLElement) {
    const preElements = node.querySelectorAll('pre')
    const cleanups: (() => void)[] = []

    preElements.forEach((pre) => {
      // Check if wrapper already exists
      if (pre.parentElement?.classList.contains('code-wrapper')) return

      const wrapper = document.createElement('div')
      wrapper.className = 'code-wrapper'
      pre.parentNode?.insertBefore(wrapper, pre)
      wrapper.appendChild(pre)

      const btn = document.createElement('button')
      btn.className = 'code-copy-btn'
      btn.type = 'button'
      btn.textContent = 'Copy'
      btn.setAttribute('aria-label', 'Copy diagram/code')

      btn.addEventListener('click', async () => {
        const textToCopy = pre.innerText
        const success = await copyToClipboard(textToCopy)
        btn.textContent = success ? 'Copied!' : 'Failed'
        setTimeout(() => {
          btn.textContent = 'Copy'
        }, 2000)
      })

      wrapper.appendChild(btn)
      cleanups.push(() => btn.remove())
    })

    return {
      destroy() {
        cleanups.forEach((fn) => fn())
      }
    }
  }
</script>

<svelte:head>
  <title>{post.name} | Raafat Turki</title>
  <meta name="description" content={post.desc} />
  <meta property="og:title" content={post.name} />
  <meta property="og:description" content={post.desc} />
  <meta property="og:type" content="article" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content={post.name} />
  <meta name="twitter:description" content={post.desc} />
</svelte:head>

<main class="page">
  <header class="top-bar">
    <div class="brand">
      <a href="/">std-folio</a>
    </div>

    <nav class="nav-links" aria-label="Navigation">
      <a href="/#blogs">← Blogs</a>
    </nav>
  </header>

  <article class="blog-post">
    <header class="blog-post-header">
      <time datetime={post.date}>{post.date}</time>
      <h1>{post.name}</h1>
      <p>{post.desc}</p>
    </header>

    <div class="blog-content" use:enhanceCodeBlocks>
      {@html post.html}
    </div>
  </article>
</main>
