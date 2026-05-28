# Feature Test Checklist

Use this after setting up the example project to verify every feature works.

## Setup
- [ ] Created notebook "The Shattered Crown"
- [ ] Created note: `StoryLine Config` (with JSON body)
- [ ] Created 6 scene notes (The Awakening through The Coronation)
- [ ] Created 4 character notes (Anna, Marcus, Aldric, Leona)
- [ ] Created 3 location notes (Thornfield, Voldemort's Lair, Whispering Caves)
- [ ] Created 2 artifact notes (Starfall Blade, Obsidian Circlet)
- [ ] Opened StoryLine panel and selected "The Shattered Crown"

## Note Prefixes (check Joplin sidebar)
- [ ] Scene notes show `[Scene] [A1C01] The Awakening` format
- [ ] Character notes show `[Character] Anna Heath` format
- [ ] Location notes show `[Location] Thornfield Castle` format
- [ ] Artifact notes show `[Artifact] Starfall Blade` format
- [ ] Notes sort nicely: all [Artifact]s, then [Character]s, then [Location]s, then [Scene]s

## Board View
- [ ] 5 columns visible: Idea, Outline, Draft, Revised, Done
- [ ] "The Siege" + "The Coronation" in Idea column
- [ ] "The Betrayal" in Outline column
- [ ] "The Garden" in Draft column
- [ ] "The Council" in Revised column
- [ ] "The Awakening" in Done column
- [ ] Cards show act.chapter badge (e.g., "1.1")
- [ ] Cards show POV name
- [ ] Cards show word count
- [ ] Cards show location pin icon
- [ ] Cards show plotline color dots
- [ ] Drag a card to a different column → status updates
- [ ] Click a card → Inspector shows scene metadata

## Plotgrid View
- [ ] 3 plotline columns visible: Main Plot (red), Romance (pink), Political Intrigue (blue)
- [ ] Scenes sorted by act then chapter
- [ ] Scene title cells show act/chapter info
- [ ] Click a scene title → Inspector opens
- [ ] Empty cells show dashed borders (gap visualization)
- [ ] Filled cells show colored left border matching plotline
- [ ] Type in a cell, blur → data saves
- [ ] Type in an empty plotline cell → plotline auto-assigns to scene (check Board view for new dot)
- [ ] Clear a cell → plotline auto-removes from scene
- [ ] "+ Plotline" button works (add a test plotline, verify column appears)
- [ ] Double-click plotline header → rename inline (content preserved!)
- [ ] Click × on plotline header → delete with confirmation (content removed from all scenes)

## Plotgrid — Entity Pills
- [ ] Type "Anna" in a cell → green pill for "Anna Heath"
- [ ] Type "Marcus" in a cell → green pill for "Marcus Vael"
- [ ] Type "Aldric" in a cell → green pill for "Lord Aldric Vane"
- [ ] Type "Leona" in a cell → green pill for "Duchess Leona Ashford"
- [ ] Type "Thornfield" in a cell → red pill for "Thornfield Castle"
- [ ] Type "Voldemort's Lair" in a cell → red pill (apostrophe matching!)
- [ ] Type "Starfall Blade" in a cell → blue pill for artifact
- [ ] Type "Obsidian Circlet" in a cell → blue pill for artifact
- [ ] Pill colors differ by type: green (character), red (location), blue (artifact)

## Plotgrid — Disambiguation
- [ ] Type "The Commander" in a cell → NO pills (shared by Marcus + Aldric)
- [ ] Type "Marcus" in same cell → pill for Marcus only

## Plotgrid — Alias Matching
- [ ] "AH" matches Anna Heath (2-char alias)
- [ ] "Vael" matches Marcus Vael
- [ ] "Vane" matches Lord Aldric Vane
- [ ] "Duchess" matches Duchess Leona Ashford
- [ ] "The Keep" matches Thornfield Castle
- [ ] "Starfall" matches Starfall Blade
- [ ] "Circlet" matches Obsidian Circlet

## Timeline View
- [ ] Scenes sorted by date (1042-03-15, 1042-03-16, 1042-04-02, etc.)
- [ ] Each row shows date/time, title, act, POV, location, word count
- [ ] Click a timeline card → Inspector opens

## Codex View
- [ ] 3 tabs visible: Characters (4), Locations (3), Artifacts (2)
- [ ] Tab colors match type colors (green, red, blue)
- [ ] Entity cards show "aka: ..." for entries with aliases
- [ ] Click an entity card → Inspector opens with type-colored header
- [ ] "+ Add Characters" button creates a new character note
- [ ] ⚙ Types button shows type management panel
- [ ] Can add a new custom type (e.g., "Factions")
- [ ] Can remove a type (if >1 types exist)

## Inspector — Scene
- [ ] Title field shows clean name (no [Scene] prefix)
- [ ] Status dropdown with 5 options
- [ ] Act/Chapter number fields
- [ ] POV, Location, Date, Time fields
- [ ] Plotlines field (comma-separated)
- [ ] Custom fields section: "mood" and "weather" visible
- [ ] "+ Field" button adds a new custom field
- [ ] Save button persists changes
- [ ] Open Note button opens the Joplin note
- [ ] After changing act/chapter and saving → Joplin note title prefix updates

## Inspector — Codex Entity
- [ ] Type-colored header badge (e.g., green "CHARACTER")
- [ ] Name field shows clean name (no prefix)
- [ ] Aliases field (comma-separated)
- [ ] Help text about alias usage
- [ ] Custom fields visible: "age" and "role" for characters, "region" for locations, "power" for artifacts
- [ ] Save button persists changes
- [ ] Open Note button opens the Joplin note

## Edge Cases
- [ ] Refresh button (↻) reloads data without errors
- [ ] Switch between views rapidly — no crashes
- [ ] Create a new scene via "+ Scene" → appears in Board with prefix in Joplin sidebar
- [ ] Edit a scene title in Inspector, save → prefix updates, display name stays clean
- [ ] Legacy notes without prefixes still display correctly (stripPrefix passes them through)
