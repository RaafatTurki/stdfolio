<script lang="ts">
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()

const site = data.site
const posts = data.posts.posts
const projects = site?.projects ?? []
const links = site?.links ?? []
const manifesto = site?.manifesto ?? []
const stats = site?.stats ?? []
const role = site?.role ?? 'Title'
const name = site?.name ?? 'Anon'
const email = site?.email ?? 'hello@domain.dev'
const resumeLink = site?.resume_link ?? 'https://resume.raafat.io'
const year = new Date().getFullYear()
</script>

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
      <a class="status mono" href={`mailto:${email}`}>EMAIL: {email}</a>
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
          <div class="projects-name">
            {(project.name ?? 'untitled')}
          </div>
          <div class="projects-meta">{project.status}</div>
          <a
            class="projects-link"
            href={project.link}
            target="_blank"
            rel="noreferrer"
            aria-label={`Inspect ${(project?.name ?? 'project').toString()}`}
          >
            Visit →
          </a>
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
            <a class="blogs-item" href={post.link} target="_blank" rel="noreferrer">
              <span class="blogs-date">{post.date}</span>
              <span class="blogs-title">{post.title}</span>
              <span class="blogs-summary">{post.summary}</span>
            </a>
          </li>
        {/each}
      {:else}
        <li class="blogs-empty">No blog entries yet.</li>
      {/if}
    </ul>
  </section>

  <!-- <section class="terminal reveal" style="--delay: 0.28s" aria-labelledby="system-logs-title"> -->
    <!-- <h2 id="system-logs-title" class="terminal-header">SYSTEM_LOGS // PROJECT_MANIFEST</h2> -->
    <!-- <div class="terminal-grid"> -->
    <!--   <div> -->
    <!--     <h3 class="terminal-label">// ARCHITECTURE_PRINCIPLES</h3> -->
    <!--     <ul class="terminal-list"> -->
    <!--       {#each manifesto as line} -->
    <!--         <li>{line}</li> -->
    <!--       {/each} -->
    <!--     </ul> -->
    <!--   </div> -->
    <!--   <div> -->
    <!--     <h3 class="terminal-label">// PERFORMANCE_METRICS</h3> -->
    <!--     <ul class="terminal-list"> -->
    <!--       {#each stats as stat} -->
    <!--         <li>{stat.label}: {stat.value}</li> -->
    <!--       {/each} -->
    <!--     </ul> -->
    <!--   </div> -->
    <!-- </div> -->
  <!-- </section> -->

  <footer id="connect" class="footer reveal" style="--delay: 0.34s">
    <div>{year} {name}. I make computers do stuff.</div>
    <nav class="footer-links" aria-label="Footer">
      {#each links as link}
        <a href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
      {/each}
    </nav>
  </footer>
</main>
