# Running Out

**Premises:** 01 Agency × 05 Possibility

Stamp shapes onto a canvas — but every tool has limited uses, and each mark is smaller than the last, until nothing is possible anymore.

**Live:** https://YOUR-USERNAME.github.io/premise-remix/

## How to use
- Click or tap the canvas to stamp the selected shape.
- Choose a tool with the buttons or keys **1–4**.
- Keyboard only: **arrow keys** move the cursor, **Space/Enter** stamps, **R** restarts.

## Where the premises live (script.js)
- **Agency** — `stamp()`: every action adds a permanent mark to the canvas.
- **Possibility** — `canAct()`, `spend()`, `sizeFor()`: every action removes a use, shrinks the next mark, retires used-up tools, and finally freezes the canvas.
- All numbers and rules are in the `knobs` object at the top of `script.js`.

## Credits
- Code, layout and shapes: my own, written with AI assistance (see note below).
- The "knobs" settings-object structure follows the NMED 3203 Interactive Media Applications lab experiments.
- No external assets or libraries.

## AI note
<!-- Write this yourself: which tools you used and for what, plus one example
     where you rejected or corrected what the tool produced. -->
