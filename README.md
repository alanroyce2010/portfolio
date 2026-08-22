# Portfolio site

Plain HTML/CSS/JS, no dependencies, no build step at deploy time. The one
exception is blog posts: those are authored in Markdown and compiled to
static HTML locally (with a zero-dependency Node script) before committing —
the deployed site never runs any build.

```
index.html                    homepage, project list
about.html
css/style.css, css/blog.css
images/                       project screenshots/figures, copied from each project's own repo
projects/<slug>/index.html    one page per project
blog.html                     blog index — generated, do not hand-edit
blog/posts/*.md               blog post source (write here)
blog/<slug>.html              blog post output — generated, do not hand-edit
scripts/build-blog.mjs        the Markdown -> HTML compiler for blog/
```

## Writing a blog post

1. Copy the template: `cp blog/posts/_template.md blog/posts/your-slug.md`
   (the filename, minus `.md`, becomes the URL slug).
2. Fill in the frontmatter (`title`, `date`, `category`, and optionally
   `description`/`excerpt`/`citekey`) and write the post in Markdown — see
   the template for the supported syntax (`##`/`###` headings with an
   auto-built table of contents, **bold**/*italic*/`code`, links, images
   with captions, lists, fenced code blocks, a `::: callout ::: ` aside, and
   `$..$`/`$$..$$` math rendered client-side by KaTeX).
3. Build it:
   ```bash
   npm run blog   # or: node scripts/build-blog.mjs
   ```
   This regenerates `blog/your-slug.html` and rewrites `blog.html`'s post
   list (newest first) to include it.
4. Preview locally (below), then commit and push — Cloudflare deploys from
   the pushed HTML, same as any other page.

## Preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to Cloudflare Pages

```bash
npx wrangler pages deploy . --project-name <your-project-name>
```

Or connect this repo in the Cloudflare dashboard (Pages → Create project →
Connect to Git): no build command needed, output directory is `.` (repo root).

## To do before publishing

- Replace every `YOUR-GITHUB-USERNAME` / `YOUR-LINKEDIN` placeholder in the
  header/footer nav and project links (search: `grep -rn "YOUR-" .`).
- Once `project/slicer` (in the `origami` thesis repo) is deployed, add its
  live URL to `projects/origami-toolpath-thesis/index.html`.
