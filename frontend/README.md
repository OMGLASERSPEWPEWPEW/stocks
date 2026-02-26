# Frontend

React + TypeScript + Vite frontend for the stock terrain visualization.

See the [root README](../README.md) for full project documentation, setup instructions, and architecture overview.

## Local development

```bash
npm install
npm run dev        # dev server at http://localhost:5180
```

Backend must be running at `http://localhost:8001` (or set `VITE_API_URL`).

## Other commands

```bash
npm run build      # production build → dist/
npm run lint       # ESLint
npm run preview    # preview production build locally
npx tsc --noEmit   # type-check only
```
