# Exam data schema

Every exam lives in `data/exams/<id>/` as five JSON files (UTF-8, 2-space indent).
Images live in `data/img/<id>/`. The build step inlines everything into one HTML file,
so paths must be relative to `data/` (for example `img/p2025/q14.png`).

Split files exist so the Portuguese and Math halves can be edited at the same time
without touching the same file. Never write another exam's folder.

Exam ids (application year, `m` = manhã, `t` = tarde):
`p2014 p2015 p2016m p2016t p2017m p2017t p2018m p2018t p2019 p2022 p2023 p2024 p2025`,
plus the math-only sets `f2011` and `f2013` (CP2 Digital Google Forms adaptations).

All user-facing content is Brazilian Portuguese with correct accents. Transcriptions
must be faithful to the original, including its punctuation (the original texts may
contain em dashes; keep them in transcriptions). Text written by us (explanations,
tips, alt text) must NOT use the em dash character; use commas, colons or parentheses.

## meta.json

```json
{
  "id": "p2025",
  "year": 2025,                 // year the exam was applied
  "ingress_year": 2026,         // school year the candidate enters (null if unknown)
  "shift": null,                // "manha" | "tarde" | null
  "title": "Prova 2025",        // short label shown in the app, e.g. "Prova 2018 (manhã)"
  "edital": "Edital nº 42/2025",
  "applied_on": "2025-11-02",   // ISO date if printed anywhere, else null
  "duration_min": 180,
  "source_url": "https://...",  // official PDF URL (given in your task)
  "answer_key_url": "https://...",
  "answer_key_kind": "definitivo", // "definitivo" | "preliminar" | "oficial" | "resolvido" (no official key)
  "notes": ["free text notes, e.g. 'Diurno e noturno tiveram a mesma prova.'"]
}
```

## texts.json

Array of the Portuguese support texts (and any shared context used by several
questions). Order = order in the exam.

```json
{
  "id": "T1",
  "label": "Texto 1",           // exactly as printed ("Texto 1", "Texto I", "Texto 2" ...)
  "title": "Novos estudos revelam os graves impactos do uso de celulares por crianças",
  "subtitle": "Há problemas inclusive no modo como se alimentam, ...",   // or null
  "author": "Paula Felix",      // or null
  "kind": "prosa",              // "prosa" | "poema" | "tirinha" | "charge" | "imagem" | "grafico" | "outro"
  "numbering": "every5",        // how the exam shows line numbers: "every5" | "all" | "none"
  "lines": [                    // one entry per PRINTED line, in order, exactly as broken in the exam
    "Em um passado não tão distante, os mais novos se divertiam correndo em casa, na",
    "..."
  ],
  "para_starts": [1, 7, 18],    // 1-based line numbers that start an indented paragraph
  "stanza_breaks": [],          // poems: 1-based line numbers AFTER which a blank stanza gap appears
  "images": [                   // non-verbal texts or illustrations that belong to the text
    {"src": "img/p2025/t3.png", "alt": "Tirinha em 3 quadros. Q1: ... (transcribe every balloon)"}
  ],
  "source": "Publicado em VEJA 10 de maio de 2024, edição nº 2892. Disponível em: ... Adaptado.",
  "glossary": [{"term": "diretrizes", "def": "princípios, orientações"}],
  "epigraph": null              // optional quote printed before the text
}
```

Rules for `lines`:
- Line numbers matter: questions cite "linha 12", "l. 5-6". The i-th entry of `lines` must be
  the line the exam numbers as i. Verify against the printed 05/10/15 markers.
- Inline HTML allowed inside a line: `<i> <b> <u> <sup>` (glossary markers like `inércia<sup>2</sup>`).
- Do not put the line numbers themselves in the strings.
- For texts that are only an image (tirinha, charge, infographic), `lines` is `[]` and
  `images` holds the crop; `alt` must transcribe all words in the image.
- If a text has no line numbers but has lines, use `"numbering": "none"`.

## questions-pt.json and questions-mat.json

Arrays of questions in exam order. Portuguese questions go in `questions-pt.json`,
Math in `questions-mat.json` (math-only sets have an empty PT file).

```json
{
  "n": 14,                       // number printed in the exam
  "subject": "matematica",       // "portugues" | "matematica"
  "texts": ["T1"],               // ids from texts.json this question depends on ([] if none)
  "stem": "<p>Durante o intervalo ...</p><p>... é</p>",
  "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
  "answer": "C",                 // official key; null if annulled
  "annulled": false,
  "answer_source": "oficial",    // "oficial" | "resolvido" (only f2011/f2013)
  "topics": ["mat.geo.cartesiano", "mat.geo.pitagoras"],  // 1-3 ids from data/topics.json, primary first
  "difficulty": 2,               // 1 easy, 2 medium, 3 hard (estimate for a strong 9th grader)
  "explanation": "<p>...</p>",   // filled in the explanation stage
  "distractors": {"A": "...", "B": "...", "D": "..."},  // why each wrong option is wrong / what error leads to it
  "tip": "Distância entre dois pontos é Pitágoras disfarçado."  // one-line takeaway
}
```

Formatting inside `stem`, `options`, `explanation`, `distractors`:
- HTML subset: `p br b i u sup sub ul ol li table thead tbody tr th td blockquote img span`.
- Math uses LaTeX inside `\( ... \)` (inline) or `\[ ... \]` (display), rendered by KaTeX.
  Never use `$` as a math delimiter (it clashes with "R$"). In JSON strings the backslash
  is escaped: `"\\(x^2 + 1\\)"`. Money stays plain text: `R$ 12,50`.
- Decimal comma as in the original (`3,5`). Inside LaTeX write `3{,}5` so KaTeX does not add a space.
- Images: `<img src="img/p2025/q14.png" alt="...">`. The alt text must describe the figure well
  enough that a student could understand the question without seeing it (all labels, values, axes).
- Quotes from the text keep their original quotation marks and line references.
- Tables in the exam become real HTML tables, not images, when they are plain data.
- Figures (geometry, charts, maps, comics) become cropped images via `tools/crop.py`.
- The explanation must reach the official answer. It is written for a 9th-grade student,
  step by step, in clear Brazilian Portuguese, no em dash.

## redacao.json

```json
{
  "genre": "dissertativo-argumentativo",  // or "carta argumentativa", "texto opinativo", ...
  "theme": "Problemas relacionados ao excesso de telas eletrônicas na época atual.",
  "prompt_html": "<p>Os textos da prova de Língua Portuguesa discutem ...</p><p class=\"tema\">...</p>",
  "requirements": ["evitar cópia integral ou parcial de fragmentos dos textos da prova", "..."],
  "zero_criteria": ["folha completamente em branco", "..."],
  "lines_min": 20,
  "lines_max": 25,
  "notes": []
}
```

`prompt_html` reproduces the whole proposal exactly (everything before "IMPORTANTE"/"Seu texto
deverá"); `requirements` and `zero_criteria` are the bullet lists, verbatim.

## Validation

Run `python3 tools/validate.py <id>` after every change. It must print `OK`.
