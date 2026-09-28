# Simulador CPII

Offline, single-file study app for the Colégio Pedro II entrance exam for the 1st year of high school
(*processo seletivo da 1ª série do Ensino Médio regular*). The interface is in Brazilian Portuguese
because the exam and its students are; code and docs are in English.

**Use it online:** https://kbrianps.github.io/simulador-cpii/

Or open `dist/simulador-cp2.html` (after building) in any modern browser, such as Edge or Chrome on
Windows. No installation, no internet connection and no server are needed: questions, images, fonts
and math rendering are all inside the file. Progress is stored in the browser's `localStorage`; the *Desempenho* page can export
and import it as JSON.

## What it does

- **Praticar**: every question from past exams, filterable by subject, exam, topic, difficulty and
  status (new, wrong, flagged). Immediate correction with a step-by-step solution, a note on why each
  wrong option is wrong, and a one-line tip. Support texts keep the exam's line numbering; line
  references in the questions ("linha 12") are clickable and a click on a line highlights it.
- **Simulado**: timed mock exam (3 hours, as in the real test) with booklet, bubble answer sheet,
  draft and ruled essay sheet. Either a full past exam or a mixed one (Portuguese block of one exam
  plus 10 math questions drawn from all exams, optionally weighted toward weak topics). Corrected
  only on delivery, with the official scoring rules (annulled questions count for everyone; a zero in
  either subject or in the essay eliminates).
- **Redação**: essay theme generator in the CPII style (bank of themes with original motivating
  texts, guiding questions, argument paths, repertoire and pitfalls), the official themes of every
  past exam, a ruled sheet that counts lines the way a handwritten sheet would (20 to 25 lines),
  automatic checks (lines, paragraphs, copying from the motivating texts, connectives, repetition,
  informal language) and a self-assessment rubric based on the edital.
- **Desempenho**: statistics on first attempts (the honest measure): accuracy by topic, subject,
  difficulty, exam and pace; where the student misses and hits the most; study priorities that
  combine how often a topic falls in the exam with how often the student misses it; evolution
  across mock exams and days; essay criteria averages; a mistakes notebook.

## Content

| Set | Source | Key |
|---|---|---|
| Provas 2014, 2015, 2016 (manhã e tarde), 2017 (manhã e tarde), 2018 (manhã e tarde), 2019, 2022, 2023, 2024, 2025 | cp2.g12.br, blog.cp2.g12.br/cp2digital and dhui.cp2.g12.br | official (2019 only has the preliminary key online) |
| Provas inéditas 01 to 10 | written for this project in the CPII format: original texts, 10 Portuguese and 10 Math questions and an essay proposal each | solved and cross-checked by independent reviewers |
| Matemática 2011 and 2013 | CP2 Digital Google Forms (questions adapted to multiple choice by the school) | solved and cross-checked, no official key |

There was no exam in 2020 and 2021 (admission by lottery during the pandemic). The exam year is the
year it was applied; students enter school the following year.

Exam content belongs to Colégio Pedro II. Solutions, tips, topic tags, the original exams and the essay
theme bank were written for this project and verified by independent passes (transcription check against the page
images, independent solving, adversarial review).

## Layout

```
sources/        original PDFs and saved CP2 Digital forms (not versioned; see source_url in each meta.json)
data/exams/<id>/ meta.json, texts.json, questions-pt.json, questions-mat.json, redacao.json
data/img/<id>/  cropped figures
data/themes.json essay theme bank (data/themes-drafts/ keeps the first per-axis drafts)
data/topics.json topic taxonomy used by the statistics
data/exam-info.json rules and date of the next exam
src/            index.html, styles.css and js/*.js (plain JavaScript, no framework)
tools/          build and data tools (see below)
DATA_SCHEMA.md  the data format
```

## Build and tools

```sh
npm install                      # katex, fonts, playwright-core (only for screenshots)
node tools/build.mjs             # writes dist/simulador-cp2.html
python3 tools/validate.py p2025 --stage explain   # schema and content checks
node tools/check_katex.mjs p2025                  # LaTeX syntax
node tools/shoot.mjs p2025                        # screenshot every question as rendered
node tools/e2e.mjs                                # drive the main flows in a headless browser
```

The build pre-renders all LaTeX with KaTeX, inlines fonts (Source Sans 3 and Literata) and images
(re-encoded as WebP when smaller) and embeds the data as JSON, so the output is one self-contained
HTML file.

Helpers used to transcribe the exams: `tools/render.sh` (render a PDF page), `tools/words.py` (text
lines with coordinates, optionally via OCR) and `tools/crop.py` (crop and optimize a figure).

To update the countdown for a new selection process, edit `data/exam-info.json` and rebuild.

## Publishing

`tools/deploy.sh` builds the app and pushes it as `index.html` to the `gh-pages` branch, which GitHub
Pages serves. Progress is stored per browser and per address, so the online version and a local copy
keep separate histories (use export/import to move it).
