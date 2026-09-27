#!/usr/bin/env python3
"""Validate one or more exam folders against DATA_SCHEMA.md.

usage: tools/validate.py <id> [<id> ...] [--stage extract|explain] [--part pt|mat]
With --stage explain, explanation/distractors/tip become mandatory.
With --part pt only meta/texts/questions-pt/redacao are checked; with --part mat
only questions-mat (use these while the other half is still being written).
Prints OK or a list of problems (exit code 1).
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
TOPICS = json.load(open(os.path.join(DATA, "topics.json"), encoding="utf-8"))
ALL_TOPICS = {**TOPICS["portugues"], **TOPICS["matematica"]}
ALLOWED_TAGS = set("p br b i u sup sub ul ol li table thead tbody tr th td blockquote img span strong em small div".split())
EM_DASH = "—"


def load(path, errs):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        errs.append(f"missing file {os.path.relpath(path, ROOT)}")
    except json.JSONDecodeError as e:
        errs.append(f"invalid JSON in {os.path.relpath(path, ROOT)}: {e}")
    return None


def check_html(where, s, errs, own_text=False):
    if not isinstance(s, str):
        errs.append(f"{where}: expected string")
        return
    for tag in re.findall(r"</?([a-zA-Z0-9]+)", s):
        if tag.lower() not in ALLOWED_TAGS:
            errs.append(f"{where}: tag <{tag}> not allowed")
    for src in re.findall(r'<img[^>]*src="([^"]+)"', s):
        if not os.path.exists(os.path.join(DATA, src)):
            errs.append(f"{where}: image not found {src}")
    for img in re.findall(r"<img[^>]*>", s):
        if 'alt="' not in img or 'alt=""' in img:
            errs.append(f"{where}: image without alt text")
    if s.count("\\(") != s.count("\\)") or s.count("\\[") != s.count("\\]"):
        errs.append(f"{where}: unbalanced LaTeX delimiters")
    if re.search(r"(?<!R)\$[^$\s][^$]*\$", s):
        errs.append(f"{where}: '$' used as math delimiter (use \\( \\))")
    if own_text and EM_DASH in s:
        errs.append(f"{where}: em dash in text written by us")


def validate(eid, stage, part=None):
    errs = []
    base = os.path.join(DATA, "exams", eid)
    want_pt, want_mat = part in (None, "pt"), part in (None, "mat")
    meta = load(os.path.join(base, "meta.json"), errs) if want_pt else None
    texts = load(os.path.join(base, "texts.json"), errs) if want_pt else None
    qpt = load(os.path.join(base, "questions-pt.json"), errs) if want_pt else None
    qmat = load(os.path.join(base, "questions-mat.json"), errs) if want_mat else None
    red = load(os.path.join(base, "redacao.json"), errs) if want_pt else None
    if part == "mat" and os.path.exists(os.path.join(base, "texts.json")):
        texts = load(os.path.join(base, "texts.json"), [])
    if meta:
        for k in ("id", "year", "title", "duration_min", "source_url", "answer_key_kind"):
            if k not in meta:
                errs.append(f"meta: missing {k}")
        if meta.get("id") != eid:
            errs.append("meta: id mismatch")
    text_ids = set()
    if isinstance(texts, list):
        for t in texts:
            tid = t.get("id")
            text_ids.add(tid)
            for k in ("id", "label", "kind", "numbering", "lines"):
                if k not in t:
                    errs.append(f"text {tid}: missing {k}")
            for i, ln in enumerate(t.get("lines", [])):
                check_html(f"text {tid} line {i+1}", ln, errs)
                if re.match(r"^\s*\d{1,2}\s{2,}", ln or ""):
                    errs.append(f"text {tid} line {i+1}: looks like it contains a printed line number")
            for im in t.get("images", []):
                if not os.path.exists(os.path.join(DATA, im.get("src", ""))):
                    errs.append(f"text {tid}: image not found {im.get('src')}")
                if not im.get("alt"):
                    errs.append(f"text {tid}: image without alt")
            if not t.get("lines") and not t.get("images"):
                errs.append(f"text {tid}: no lines and no images")
            n = len(t.get("lines", []))
            for p in t.get("para_starts", []):
                if not (1 <= p <= max(n, 1)):
                    errs.append(f"text {tid}: para_start {p} out of range")
    seen = set()
    for name, qs, subj in (("questions-pt", qpt, "portugues"), ("questions-mat", qmat, "matematica")):
        if not isinstance(qs, list):
            continue
        for q in qs:
            n = q.get("n")
            where = f"{name} Q{n}"
            if n in seen:
                errs.append(f"{where}: duplicated number")
            seen.add(n)
            if q.get("subject") != subj:
                errs.append(f"{where}: subject must be {subj}")
            for t in q.get("texts", []):
                if t not in text_ids:
                    errs.append(f"{where}: unknown text id {t}")
            check_html(f"{where} stem", q.get("stem", ""), errs)
            opts = q.get("options", {})
            if sorted(opts) != ["A", "B", "C", "D"]:
                errs.append(f"{where}: options must be exactly A-D")
            for k, v in opts.items():
                check_html(f"{where} option {k}", v, errs)
                if not str(v).strip():
                    errs.append(f"{where}: option {k} empty")
            if q.get("annulled"):
                if q.get("answer") is not None:
                    errs.append(f"{where}: annulled question must have answer null")
            elif q.get("answer") not in ("A", "B", "C", "D"):
                errs.append(f"{where}: invalid answer {q.get('answer')}")
            tps = q.get("topics", [])
            if not (1 <= len(tps) <= 3):
                errs.append(f"{where}: needs 1-3 topics")
            for tp in tps:
                if tp not in ALL_TOPICS:
                    errs.append(f"{where}: unknown topic {tp}")
                elif not tp.startswith("pt." if subj == "portugues" else "mat."):
                    errs.append(f"{where}: topic {tp} from the wrong subject")
            if q.get("difficulty") not in (1, 2, 3):
                errs.append(f"{where}: difficulty must be 1, 2 or 3")
            if stage == "explain":
                if not q.get("explanation"):
                    errs.append(f"{where}: missing explanation")
                if not q.get("tip"):
                    errs.append(f"{where}: missing tip")
                if not q.get("annulled"):
                    wrong = {"A", "B", "C", "D"} - {q.get("answer")}
                    if set(q.get("distractors", {})) != wrong:
                        errs.append(f"{where}: distractors must cover exactly {sorted(wrong)}")
            if "explanation" in q:
                check_html(f"{where} explanation", q["explanation"], errs, own_text=True)
            for k, v in q.get("distractors", {}).items():
                check_html(f"{where} distractor {k}", v, errs, own_text=True)
            if "tip" in q:
                check_html(f"{where} tip", q["tip"], errs, own_text=True)
    if red is not None and eid.startswith("p"):
        for k in ("genre", "theme", "prompt_html", "requirements", "lines_min", "lines_max"):
            if k not in red:
                errs.append(f"redacao: missing {k}")
        check_html("redacao prompt", red.get("prompt_html", ""), errs)
    if eid.startswith("p") and part is None:
        total = len(qpt or []) + len(qmat or [])
        if total != 20:
            errs.append(f"expected 20 questions, found {total}")
    return errs


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    stage = "explain" if "--stage" in sys.argv and sys.argv[sys.argv.index("--stage") + 1] == "explain" else "extract"
    part = sys.argv[sys.argv.index("--part") + 1] if "--part" in sys.argv else None
    args = [a for a in args if a not in ("extract", "explain", "pt", "mat")]
    bad = False
    for eid in args:
        errs = validate(eid, stage, part)
        if errs:
            bad = True
            print(f"{eid}: {len(errs)} problem(s)")
            for e in errs:
                print("  -", e)
        else:
            print(f"{eid}: OK")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
