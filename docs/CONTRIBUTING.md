# Contributing

## Branch model

| Branch | Purpose |
|--------|---------|
| `main` | Stable, deployable |
| `production-hardening` | Current hardening / docs sprint |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |

Keep feature branches short-lived. Open PRs against `main`.

## Code style

**Python** — follow PEP 8. Use `black` for formatting and `ruff` for linting:
```bash
pip install black ruff
black backend/
ruff check backend/
```

**JavaScript** — ESLint is configured in `frontend/`. Run:
```bash
cd frontend
npm run lint
```

No inline comments explaining *what* the code does. Only add a comment when the *why* is non-obvious.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) style:

```
feat: add spaced-repetition scheduling
fix: prevent BKT mastery from exceeding 1.0
docs: expand ARCHITECTURE.md sync section
chore: pin PyJWT to 2.10
```

## Running checks before a PR

```bash
# Frontend
cd frontend
npm run lint
npm run build

# Backend — run unit tests
cd backend
python -m pytest
```

## PR checklist

- [ ] `npm run lint` and `npm run build` pass
- [ ] Backend unit tests pass (`python -m pytest`)
- [ ] New env vars added to both `.env.example` files
- [ ] New API endpoints documented in `docs/API.md`
- [ ] Any new Supabase tables/columns added to `db/migrations/`

## Reporting bugs

Open an issue on GitHub with:
- Steps to reproduce
- Expected vs actual behaviour
- Backend logs (`ocr.log`, uvicorn stdout) if relevant
- OS and browser/Python version
