---
title: Your Post Title Here
description: One-sentence summary used in the <meta description> tag and as the blog-index excerpt fallback.
date: 2026
category: Topic / Subtopic
excerpt: Optional longer blurb for the blog index card. Omit this line to just reuse the description above.
citekey: gabriel2026yourslug
---

Opening paragraph. No H1 needed here: the title above comes from the
frontmatter and is rendered as the page's `<h1>` automatically.

Every `##` becomes a numbered-in-order section with an anchor and an entry
in the sidebar table of contents. `###` makes a plain subheading with no
TOC entry.

## First Section Title

Inline formatting: **bold**, *italic*, `inline code`, and
[a link](projects/some-project/index.html) — write local links and image
paths relative to the repo root; the build script rewrites them for the
`blog/` subdirectory automatically. External links get `target="_blank"`
automatically.

- Bullet
- Points
- Work

1. Numbered
2. Lists
3. Too

Inline math like $E = mc^2$ and display math:

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

get picked up by KaTeX automatically — the build script only loads the
KaTeX assets on pages that actually contain a `$`.

![Alt text for accessibility](images/some-folder/figure.svg "Optional caption shown under the figure")

## A Second Section

A fenced code block:

```python
def hello():
    print("hello")
```

A pull-quote / highlighted aside:

::: callout
The one-paragraph takeaway you want a skimming reader to not miss.
:::

---

Build it into `blog/your-slug.html` and regenerate `blog.html`:

```sh
node scripts/build-blog.mjs
```

Then commit and push as usual.
