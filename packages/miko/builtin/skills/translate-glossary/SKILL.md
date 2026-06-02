---
name: translate-glossary
description: Locale-specific translation glossaries (do-not-translate terms, preferred terminology, tone/phrasing guidance) used when translating English docs and UI copy into other languages. Load this when running the /translate workflow or translating to a specific locale.
---

# Translation Glossaries

Per-locale translation guidance bundled with Miko. Each locale has its own file in this
skill's base directory, named `<locale>.md`. The files are shipped inside the release
binary, so they are available in any project directory.

When translating to a target language, read the matching locale file (relative to this
skill's base directory) and apply its rules:

- **Do Not Translate**: locale-specific terms/casing to preserve verbatim.
- **Preferred Terms**: preferred translations for recurring UI/docs words.
- **Guidance / Avoid**: tone, phrasing, and wording to prefer or avoid.

## Available locales

`ar`, `br` (Brazilian Portuguese / pt-BR), `bs`, `da`, `de`, `es`, `fr`, `ja`, `ko`, `no`,
`pl`, `ru`, `th`, `tr`, `zh-cn`, `zh-tw`

Read `<locale>.md` for the target language (for example, `zh-cn.md`). If no exact file
exists for the target locale, fall back to the language-level file when present (for
example, `fr.md` for any French variant), otherwise translate without locale-specific
additions.
