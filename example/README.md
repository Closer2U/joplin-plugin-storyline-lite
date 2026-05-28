# StoryLine Example Project — "The Shattered Crown"

This folder contains all the notes you need to create inside a single Joplin notebook
to test every StoryLine feature. Create a notebook called **The Shattered Crown** in
Joplin, then create each note below (copy-paste title + body exactly).

## Setup

1. Install the StoryLine plugin (`io.arena.joplin-storyline_v0.2.0.jpl`)
2. Create a Joplin notebook named **The Shattered Crown**
3. Create each note listed in this folder inside that notebook
4. Open StoryLine panel → select "The Shattered Crown" from the project dropdown
5. Hit the ↻ refresh button

## What this tests

| Feature | Covered by |
|---------|-----------|
| Board — all 5 statuses | Scenes spread across Idea/Outline/Draft/Revised/Done |
| Board — drag & drop | Move any card between columns |
| Board — plotline dots | Scenes have plotlines assigned → dots visible |
| Plotgrid — multiple plotlines | 3 plotlines: Main Plot, Romance, Political Intrigue |
| Plotgrid — plotline colors | Each plotline has a distinct color |
| Plotgrid — auto plotline assignment | Write in a plotgrid cell → plotline auto-added to scene |
| Plotgrid — entity pills (characters) | Cell text mentions character names → green pills |
| Plotgrid — entity pills (locations) | Cell text mentions location names → red pills |
| Plotgrid — alias matching | "Anna" matches "Anna Heath" via alias |
| Plotgrid — apostrophe matching | "Voldemort's Lair" matches exactly |
| Plotgrid — disambiguation | Two characters share alias "The Commander" — no false pill |
| Plotgrid — rename plotline | Double-click a plotline header to rename |
| Plotgrid — delete plotline | Click × on a plotline header to delete |
| Plotgrid — gap visualization | Empty cells show dashed borders |
| Timeline — date sorting | Scenes have dates, sorted chronologically |
| Codex — Characters | 4 characters with aliases |
| Codex — Locations | 3 locations (one with apostrophe) |
| Codex — custom type (Artifact) | 2 artifacts |
| Codex — type colors | Each type has distinct dark color |
| Codex — alias display | "aka:" shown on codex cards |
| Inspector — scene fields | All standard fields populated |
| Inspector — entity fields | Name, aliases, custom fields |
| Inspector — custom fields | "mood" and "weather" on scenes; "age" and "role" on characters |
| Inspector — save & refresh | Edit any field, save, verify |
| Note prefixes | Notes in Joplin sidebar: [Scene] [A1C01]..., [Character]..., etc. |
| Note prefix — act/chapter update | Change act/chapter in Inspector → prefix updates |
