# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code style

- No leading underscores on function names; use clear, descriptive names
- Import modules at the top of each file only
- Avoid docstrings unless non-obvious; one short line max
- JS/scripts go in separate files, not inline in Python strings (exception: recorder injection script — keep it in `recorder.py` for now until it grows)
- System prompts in separate files or constants, not inline
- Maintain both OpenAI and Anthropic clients so they're switchable; define clients in a dedicated module
- Create classes when encapsulation helps; avoid files with too many unrelated functions
- `optexity/` is reference only — consult it for architectural decisions, do not modify it
- CLEAN MODULAR BEAUTIFUL CODE
