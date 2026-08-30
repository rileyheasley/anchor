# Assets

Design assets that are imported directly into components (processed/bundled by Vite).

- `icons/` — custom SVG/PNG icons used in the UI
- `logos/` — app/brand logos and wordmarks
- `images/` — illustrations, backgrounds, and other imagery

Import these with relative paths, e.g.:

```tsx
import logo from '../assets/logos/anchor-logo.svg';
```

For static files that need to be served as-is at a fixed URL (e.g. referenced by absolute path, favicons, or files used outside the bundler), put them in the top-level `public/` folder instead.
