# CLAUDE.md

This repository is the project root for "База Бабиновых": a private family knowledge base and medical family operating system.

Use Russian for user-facing product language and for conversation unless the user explicitly asks otherwise.

## Repository Rules

- Keep the existing Astro and CSS stack.
- Do not convert the project to Next.js, React, shadcn/ui, Tailwind, or another framework unless explicitly requested.
- Do not install packages unless explicitly requested.
- Do not commit or push unless explicitly requested.
- Do not change medical data unless explicitly requested.
- Before UI work, read `AGENTS.md`, `docs/design-system.md`, `docs/ui-reference.md`, and `.agents/skills/dark-family-os-ui/SKILL.md`.

## Visual Freeze

The currently implemented dark interface is the accepted visual baseline and source of truth.

For future tasks, do not:

- change the color system;
- change card radii;
- change typography;
- change shadows;
- change the overall visual mood;
- redesign cards merely for aesthetic polish;
- try to re-approximate the interface to the references;
- use `design/references/` as a mandatory visual target.

Use `design/references/` only as conceptual guidance for:

- information architecture;
- module logic;
- drill-down pages;
- data structure;
- UX patterns.

Do not use the references for visual redesign unless the user explicitly asks.

For architectural tasks, preserve the current CSS classes, components, colors, sizes, cards, and overall appearance.

If a new structure requires small layout adjustments, make them minimal and careful, without changing the design system.

## Product And Data Safety

- The project is a private family medical OS, not a generic admin dashboard.
- Medical information must keep source and context visible wherever possible.
- Do not invent doctors, clinics, methods, diagnoses, references, or interpretations.
- Do not publish raw medical PDFs/JPGs or secrets.
