# Plotgrid Test Data

After creating all the notes and opening StoryLine, go to the **Plotgrid** tab
and type the following into the cells. Each entry below shows:
`Scene → Plotline column → What to type`

This tests auto-assignment, entity pill matching, alias matching, apostrophe
matching, and disambiguation.

---

## The Awakening (Act 1, Ch 1)

**Main Plot cell:**
```
Anna finds the crown shard in the ruins. It pulses with light. She hides it from everyone except Marcus.
```
→ Should produce pills: **Anna Heath** (via alias "Anna"), **Marcus Vael** (via alias "Marcus")
→ Plotline "Main Plot" should already be assigned (from frontmatter)

**Romance cell:**
```
(leave empty)
```
→ Should show dashed border (gap visualization)

**Political Intrigue cell:**
```
(leave empty)
```
→ Should show dashed border

---

## The Council (Act 1, Ch 2)

**Main Plot cell:**
```
Aldric presents the shard to the council. He wants to reforge the Shattered Crown.
```
→ Should produce pill: **Lord Aldric Vane** (via alias "Aldric")

**Political Intrigue cell:**
```
Leona opposes the plan. She and Aldric clash publicly. The court is divided.
```
→ Should produce pills: **Duchess Leona Ashford** (via alias "Leona"), **Lord Aldric Vane** (via alias "Aldric")
→ Plotline "Political Intrigue" should auto-add to this scene

---

## The Garden (Act 1, Ch 3)

**Romance cell:**
```
Anna and Marcus share a quiet moment in the Thornfield gardens. He promises to show her the coast.
```
→ Should produce pills: **Anna Heath** (alias "Anna"), **Marcus Vael** (alias "Marcus"), **Thornfield Castle** (alias "Thornfield")

**Main Plot cell:**
```
(leave empty)
```

**Political Intrigue cell:**
```
(leave empty)
```

---

## The Betrayal (Act 2, Ch 4)

**Main Plot cell:**
```
Aldric discovers Leona's betrayal at Voldemort's Lair. She has allied with the Crown Seekers.
```
→ Should produce pills: **Lord Aldric Vane** (alias "Aldric"), **Duchess Leona Ashford** (alias "Leona"), **Voldemort's Lair** (exact title match with apostrophe!)

**Political Intrigue cell:**
```
Leona reveals her plan: destroy every shard. Aldric draws the Starfall Blade.
```
→ Should produce pills: **Duchess Leona Ashford** (alias "Leona"), **Lord Aldric Vane** (alias "Aldric"), **Starfall Blade** (alias "Starfall" or title)

---

## The Siege (Act 2, Ch 5)

**Main Plot cell:**
```
The enemy attacks Thornfield Castle at dawn. Anna holds the shard. The Obsidian Circlet glows on the enemy commander's brow.
```
→ Should produce pills: **Thornfield Castle** (title), **Anna Heath** (alias "Anna"), **Obsidian Circlet** (title)

**Romance cell:**
```
Marcus refuses to leave Anna's side on the wall. She asks him to take the shard and run. He won't.
```
→ Should produce pills: **Marcus Vael** (alias "Marcus"), **Anna Heath** (alias "Anna")

---

## The Coronation (Act 3, Ch 8)

All cells should be **empty** — this scene has no plotlines assigned.
This tests the "all-empty row" in the plotgrid (every cell should show dashed borders).

After you type something in any cell (e.g., type "Anna enters the cave" in the
Main Plot column), that plotline should auto-assign to the scene — verify by
switching to the Board view and checking for the plotline dot on the card.

---

## Disambiguation Test

Both **Marcus Vael** and **Lord Aldric Vane** have the alias **"The Commander"**.

Type this into any plotgrid cell:
```
The Commander rallies the troops.
```
→ Should produce **NO pills** for either character, because "The Commander" is
ambiguous (shared by two entities). The disambiguation logic skips it.

Now type:
```
Marcus rallies the troops.
```
→ Should produce a pill for **Marcus Vael** only (unambiguous alias).
