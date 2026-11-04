# Running Out

**Premises:** 01 Agency × 05 Possibility

Press and hold to grow shapes on a canvas. Every mark claims its space and spends shared ink, so each choice you make shrinks what you can still do.

**Live:** https://oykusss.github.io/NMED3203/assignment/

## How to use
- **Press and hold** on the canvas to grow a shape; **release** to stamp it. A quick tap makes the smallest mark.
- A growing shape stops when it touches another mark's space, the edge, or when ink runs out.
- Choose a shape with the buttons or keys **1–4**.
- **Keyboard only:** arrow keys move the cursor, **hold Space** (or Enter) to grow, release to stamp.
- **M** switches between *Claimed* mode (marks block space) and *Free* mode (marks may overlap). **R** restarts.

## Where the premises live (script.js)
- **Agency:** `startGrowing()`, `grow()`, `commit()`. The participant chooses where, how big and which shape every mark is.
- **Possibility:** `spaceLimit()`, `inkLimit()`, `anyRoomLeft()`. Every mark claims space and spends ink, and these limits come from the participant's own earlier marks.
- **Comparison:** *Claimed* vs *Free* mode differ in one rule only (`knobs.blockSpace`).
- All numbers and rules are in the `knobs` object at the top of `script.js`.

## Credits
- Code, layout and shapes: my own, written with AI assistance (see note below).
- The `knobs` settings-object structure follows the NMED 3203 Interactive Media Applications lab experiments.
- No external assets or libraries.

## AI note
I used Claude (Anthropic) to compare premise pairs, to write the HTML/CSS/JavaScript, to explain the code to me, and to draft the rationale text, which I then checked against the two readings myself.
Example of a correction: the first version only counted uses per tool (each tool had 6 stamps). I judged this too close to the example in the brief, because my actions did not change *which* possibilities disappeared, so I rejected it and asked for the claimed-space design, in which my own earlier marks limit the next ones.
