<script lang="ts">
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  const post = $derived(data.post)
</script>

<svelte:head>
  <title>{post.name}</title>
  <meta name="description" content={post.desc} />
</svelte:head>

<main class="page">
  <header class="top-bar">
    <div class="brand">
      <a href="/">std-folio</a>
    </div>

    <!-- <nav class="nav-links"> -->
    <!--   <a href="/#blogs">← Blogs</a> -->
    <!-- </nav> -->
  </header>

  <article class="blog-post">
    <header class="blog-post-header">
      <time datetime={post.date}>{post.date}</time>

      <h1>{post.name}</h1>

      <p>{post.desc}</p>
    </header>

    <pre class="blog-content">{post.content}</pre>
  </article>
</main>

<style>
.blog-content {
  /* white-space: pre-wrap; */
  overflow-wrap: break-word;
  font: inherit;
  line-height: 1.2;
  margin: 0;
}
</style>
