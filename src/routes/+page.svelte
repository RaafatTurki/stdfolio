<script lang="ts">
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()

const site = $derived(data.site)
const posts = $derived(data.posts)
const projects = $derived(site?.projects ?? [])
const tech = $derived(site?.tech ?? {})
const links = $derived(site?.links ?? [])
const role = $derived(site?.role ?? 'Title')
const name = $derived(site?.name ?? 'Anon')
const email = $derived(site?.email ?? 'hello@domain.dev')
const resumeLink = $derived(site?.resume_link ?? 'https://resume.raafat.io')
const year = new Date().getFullYear()

function emailMunger(email: string) {
  return email.replace(
    /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g,
    (_: string, local: string, domain: string) => `${local} [at] ${domain.replaceAll(".", " [dot] ")}`
  )
}

</script>

<svelte:head>
  <title>{name}</title>
</svelte:head>

<a class="skip-link" href="#intro">Skip to content</a>
<main class="page">
  <header class="top-bar reveal" style="--delay: 0.05s">
    <div class="brand">std-folio</div>
    <nav class="nav-links" aria-label="Primary">
      <a href="#intro">Intro</a>
      <a href="#projects">Projects</a>
      <a href="#blogs">Blogs</a>
      <a href="#connect">Connect</a>
    </nav>
  </header>

  <section id="intro" class="intro reveal" style="--delay: 0.1s" aria-labelledby="intro-title">
    <div class="intro-title">{name}</div>
    <dl class="intro-meta">
      <div class="intro-meta-item">
        <span class="mono">{role}</span>
      </div>
    </dl>


    <div class="intro-status">
      <a class="status mono" href={`mailto:${email}`}>{email}</a>
      <a class="status mono" href={resumeLink} target="_blank" rel="noreferrer">RESUME</a>
    </div>
  </section>

  <section id="projects" class="projects reveal" style="--delay: 0.16s" aria-labelledby="projects-title">
    <header class="section-header">
      <span class="section-index" aria-hidden="true">01</span>
      <h2 id="projects-title">PROJECTS</h2>
    </header>
    <ol class="projects-list">
      {#each projects as project, i}
        <li class="projects-item">
          <a
            class="projects-name"
            href={project.link}
            target="_blank"
            rel="noreferrer"
            aria-label={`Visit ${(project.name ?? 'project').toString()}`}
          >
            {(project.name ?? 'untitled')}
            <span aria-hidden="true">↗</span>
          </a>
          <div class="projects-desc">{project.desc}</div>
          {#if project.stack?.length}
            <ul class="projects-stack" aria-label={`${project.name ?? 'Project'} tech stack`}>
              {#each project.stack as technology}
                <li>
                  {#if tech[technology]}
                    <a
                      href={tech[technology]}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${technology} website (opens in a new tab)`}
                    >{technology}</a>
                  {:else}
                    <span>{technology}</span>
                  {/if}
                </li>
              {/each}
            </ul>
          {:else}
            <div></div>
          {/if}
        </li>
      {/each}
    </ol>
  </section>

  <section id="blogs" class="blogs reveal" style="--delay: 0.22s" aria-labelledby="blogs-title">
    <header class="section-header">
      <span class="section-index" aria-hidden="true">02</span>
      <h2 id="blogs-title">BLOGS</h2>
    </header>
    <ul class="blogs-list">
      {#if posts.length}
        {#each posts as post}
          <li>
            <a class="blogs-item" href={`/blog/${post.slug}`}>
              <span class="blogs-date">{post.date}</span>
              <span class="blogs-title">{post.name}</span>
              <span class="blogs-summary">{post.desc}</span>
            </a>
          </li>
        {/each}
      {:else}
        <li class="blogs-empty">No blog entries yet.</li>
      {/if}
    </ul>
  </section>

  <section class="terminal reveal" style="--delay: 0.28s" aria-labelledby="system-logs-title">
    <h2 id="system-logs-title" class="terminal-header">about this portfolio</h2>
    <p class="terminal-note">
      This portfolio is a self-developed project.
      <br>
      Its content is fully represented as JSON data and rendered by the site.
      <br>
      you can view the current live json <a href="https://raafat.io/data/site.json" target="_blank" rel="noreferrer">data here</a>.
      <br>
      <br>
      or the project <a href="https://github.com/RaafatTurki/stdfolio" target="_blank" rel="noreferrer">source code here</a>
    </p>
  </section>

  <footer id="connect" class="footer reveal" style="--delay: 0.34s">
    <div>{year} {name}. I make computers do stuff.</div>
    <nav class="footer-links" aria-label="Footer">
      {#each links as link}
        <a href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
      {/each}
    </nav>
  </footer>
</main>
