---
name: Content format
description: "Why the pages of the arcade use plain Markdown and not MDX, and what that means for a writer."
altitude: part
tags:
  - content
  - markdown
parent: game-entry.md
---

[Wiki](../README.md) / [Front door](front-door.md) / [Game entry](game-entry.md) / Content format

# Content format

Every page that you write for the arcade is plain Markdown in a `.md` file. The arcade does not use MDX: Markdown with components and code mixed in.

## Why not MDX

MDX is not a standard. An MDX file only works in tools that know MDX and know the components that the file imports. On GitHub, in a different editor or in a different site, the same file shows broken tags.

A plain Markdown file works everywhere. You can read it in a text editor, on GitHub, or in a preview, and it looks right. You can move it to a different tool in ten years, and it still works.

The arcade writes a lot of pages: landing pages, design notes, devlogs and the full rules of [tabletop games](tabletop-games.md). These pages must outlive any one tool. So they use the format that every tool knows.

## What a page can use

A page uses CommonMark with the GitHub extensions: tables, task lists and fenced code blocks. Metadata goes in YAML at the top of the file, between two lines of `---`.

A page does not use:

- `import` or `export` lines.
- JSX tags, such as `<DiceRoller />`.
- Code that runs when the page builds.

## Rich parts on a page

A landing page sometimes needs more than text, such as a gallery or a dice roller. A rich part must still read well as plain Markdown. A reader in a plain Markdown viewer sees useful text, not broken tags. The site then shows the same part in a richer form.

## An example

The landing page of "Ember Keep" has a table of towers:

```markdown
| Tower   | Cost | Range |
| ------- | ---- | ----- |
| Ember   | 50   | 3     |
| Bastion | 120  | 2     |
```

On GitHub, you see a table. On the arcade, you see the same table in the style of the site. Neither needs a component.

## Further reading

- [Front door](front-door.md): how the site turns entries into pages.
