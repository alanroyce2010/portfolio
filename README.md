# Portfolio site

Plain HTML/CSS, no build step, no dependencies.

```
index.html            homepage, project list
about.html
css/style.css
images/                project screenshots/figures, copied from each project's own repo
projects/<slug>/index.html   one page per project
```

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
