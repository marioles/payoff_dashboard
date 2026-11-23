# Payoff explorer

A static web page for exploring per-state payoffs in the Blue / Orange / risky-asset design.
For each profile you enter the states one by one (label, probability, Blue amount, asset
return, return on uninvested tokens). The page draws the final amount in every state as a
function of the tokens put in the risky asset, x.

Final amount in state *s*:

    Blue_s + (E − x)(1 + c_s) + x(1 + r_s)

where E is the Orange endowment, r_s is the asset return and c_s is the return on uninvested
tokens (0% means they are kept as cash).

## Views

- **This profile**: one line per state, with the mean as an option.
- **All profiles overlaid**: every compared profile on one chart. Colour shows the profile
  and the dash pattern shows the state.
- **Side by side**: one small chart per profile, all on the same axes.
- **Mean vs risk**: each profile's menu traced in (standard deviation, mean) space as x goes
  from 0 (dot) to its maximum (diamond).
- **Summary table**: the marginal distribution at a chosen x, plus mean, standard deviation
  and ranges.

Tick or untick “Compare” next to a profile to include it in the four comparison views.
Profiles are saved in your browser's local storage. Use “Export profiles” and “Import
profiles” to keep a copy or move them to another computer.

## Folder layout

    payoff-explorer/
    ├── index.html
    ├── css/
    │   └── style.css
    ├── js/
    │   └── app.js
    ├── .nojekyll
    └── README.md

Chart.js is loaded from cdnjs, so nothing needs installing or building.

## Publishing on GitHub Pages

1. Create a repository and put these files at its root, keeping the folder layout above.
2. Commit and push to the `main` branch.
3. In the repository, go to **Settings → Pages**. Under “Build and deployment”, choose
   **Deploy from a branch**, then select `main` and `/ (root)`, and save.
4. After a minute or so the site is live at `https://<your-username>.github.io/<repo-name>/`.

To try it locally, open `index.html` in a browser, or run `python3 -m http.server` in the
folder and go to http://localhost:8000.
