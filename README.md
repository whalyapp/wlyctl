# wlyctl website

Source of the one-page site at https://wlyctl.whaly.io, served by GitHub Pages.
The wlyctl CLI itself is closed source and lives in the Whaly platform monorepo; this repository only holds the public landing page.

## Layout

- `index.html`: the page
- `assets/style.css`: styles (Whaly Design System tokens: Lilita One, Work Sans, brand yellow/orange/purple)
- `assets/demo.js`: the scripted pull, agent edit, push terminal animation
- `assets/fonts/`, `assets/img/`: self-hosted brand fonts and logo
- `CNAME`: custom domain

## Preview locally

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy

GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root.
DNS: `wlyctl.whaly.io` CNAME `whalyapp.github.io`.
