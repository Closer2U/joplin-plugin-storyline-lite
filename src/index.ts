declare const joplin: any;

const CONFIG_TITLE = 'StoryLine Config';
const NOTE_FIELDS = ['id', 'title', 'body', 'parent_id'];
const COLOR_PALETTE = ['#ff6b6b','#4ecdc4','#45b7d1','#96ceb4','#ffeaa7','#fd79a8','#a29bfe','#fab1a0','#f7d794','#778beb'];

// ── Prefix helpers ──────────────────────────────────────────────────

function sceneNoteTitle(displayTitle: string, act?: any, chapter?: any): string {
  const a = act ? String(act) : '';
  const c = chapter ? String(chapter).padStart(2, '0') : '';
  const acPart = (a || c) ? (' [A' + (a || '0') + 'C' + (c || '00') + ']') : '';
  return '[Scene]' + acPart + ' ' + displayTitle;
}

function entityNoteTitle(displayTitle: string, typeKey: string, codexTypes?: any[]): string {
  let label = typeKey.charAt(0).toUpperCase() + typeKey.slice(1);
  if (codexTypes && Array.isArray(codexTypes)) {
    const t = codexTypes.find((ct: any) => ct.key === typeKey);
    if (t && t.label) {
      label = t.label.replace(/s$/i, '');
    }
  }
  return '[' + label + '] ' + displayTitle;
}

function stripPrefix(noteTitle: string): string {
  let t = noteTitle;
  while (/^\[[^\]]*\]\s*/.test(t)) {
    t = t.replace(/^\[[^\]]*\]\s*/, '');
  }
  return t || noteTitle;
}

// ── Frontmatter ─────────────────────────────────────────────────────

function parseFrontmatter(body: string): { frontmatter: Record<string, any>; content: string } {
  if (!body || !body.startsWith('---')) return { frontmatter: {}, content: body || '' };
  const end = body.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: {}, content: body };
  const yaml = body.slice(3, end).trim();
  const frontmatter: Record<string, any> = {};
  const lines = yaml.split('\n');
  let currentKey = '';
  let currentArray: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      if (currentKey) currentArray.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
    } else if (trimmed.length === 0) {
      continue;
    } else {
      if (currentKey && currentArray.length > 0) {
        frontmatter[currentKey] = currentArray;
        currentArray = [];
      }
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        currentKey = line.slice(0, colonIdx).trim();
        let val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
        frontmatter[currentKey] = val || '';
      }
    }
  }
  if (currentKey && currentArray.length > 0) frontmatter[currentKey] = currentArray;
  return { frontmatter, content: body.slice(end + 4).trim() };
}

function stringifyFrontmatter(frontmatter: Record<string, any>): string {
  const lines = ['---'];
  for (const [key, val] of Object.entries(frontmatter)) {
    if (Array.isArray(val)) {
      lines.push(`${key}:`);
      for (const item of val) lines.push(`  - ${item}`);
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push('---');
  return lines.join('\n') + '\n';
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function normalizeConfig(config: any): any {
  if (!config) config = {};
  if (!config.plotlines || !Array.isArray(config.plotlines)) config.plotlines = ['Main Plot'];
  if (!config.plotlineColors) config.plotlineColors = {};
  config.plotlines.forEach((pl: string, i: number) => {
    if (!config.plotlineColors[pl]) config.plotlineColors[pl] = COLOR_PALETTE[i % COLOR_PALETTE.length];
  });
  if (!config.codexTypes || !Array.isArray(config.codexTypes)) {
    config.codexTypes = [
      { key: 'character', label: 'Characters', color: '#2b6e4f' },
      { key: 'location', label: 'Locations', color: '#8b3a3a' }
    ];
  }
  if (!config.customFields) config.customFields = {};
  return config;
}

// ── Data access ─────────────────────────────────────────────────────

async function getFolderNotes(folderId: string): Promise<any[]> {
  const notes: any[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore && page < 20) {
    const res = await joplin.data.get(['folders', folderId, 'notes'], {
      fields: NOTE_FIELDS,
      limit: 100,
      page,
    });
    const items = (res && res.items) || [];
    notes.push(...items);
    hasMore = res.has_more;
    page++;
  }
  return notes;
}

async function findProjects() {
  try {
    const res = await joplin.data.get(['search'], {
      query: CONFIG_TITLE,
      type: 'note',
      fields: ['id', 'title', 'body', 'parent_id'],
      limit: 50,
    });
    const configs = (res.items || []).filter((n: any) => n.title === CONFIG_TITLE);
    const projects = [];
    for (const cfg of configs) {
      try {
        const folder = await joplin.data.get(['folders', cfg.parent_id]);
        projects.push({ folderId: cfg.parent_id, configNoteId: cfg.id, name: folder.title });
      } catch {
        // stale config, skip
      }
    }
    return projects;
  } catch {
    return [];
  }
}

/**
 * Adopt the currently selected note's notebook as a StoryLine project.
 * If it already has a StoryLine Config note, just return the folder info.
 * If not, create one.
 */
async function adoptCurrentNotebook() {
  // Get the currently selected note
  const selectedNote = await joplin.workspace.selectedNote();
  if (!selectedNote || !selectedNote.parent_id) {
    return { error: 'No note is currently selected in Joplin. Please select any note inside the notebook you want to adopt.' };
  }

  const folderId = selectedNote.parent_id;
  let folder;
  try {
    folder = await joplin.data.get(['folders', folderId]);
  } catch {
    return { error: 'Could not find the notebook for the selected note.' };
  }

  // Check if this folder already has a StoryLine Config note
  const notes = await getFolderNotes(folderId);
  const existingConfig = notes.find((n: any) => n.title === CONFIG_TITLE);

  if (existingConfig) {
    // Already a project — just return the info
    return { folderId, configNoteId: existingConfig.id, name: folder.title, alreadyExisted: true };
  }

  // Create a new StoryLine Config note in this folder
  const configBody = JSON.stringify(normalizeConfig({
    plotlines: ['Main Plot'],
    projectName: folder.title,
  }));
  const configNote = await joplin.data.post(['notes'], null, {
    title: CONFIG_TITLE,
    body: configBody,
    parent_id: folderId,
  });

  return { folderId, configNoteId: configNote.id, name: folder.title, alreadyExisted: false };
}

async function getProjectData(folderId: string) {
  const allNotes = await getFolderNotes(folderId);
  const configNote = allNotes.find((n: any) => n.title === CONFIG_TITLE);
  let config: any = {};
  try {
    config = configNote ? JSON.parse(configNote.body || '{}') : {};
  } catch {}
  config = normalizeConfig(config);

  const scenes: any[] = [];
  const codex: Record<string, any[]> = {};
  for (const ct of config.codexTypes) codex[ct.key] = [];
  codex['character'] = codex['character'] || [];
  codex['location'] = codex['location'] || [];

  for (const note of allNotes) {
    if (note.title === CONFIG_TITLE) continue;
    const { frontmatter, content } = parseFrontmatter(note.body);

    if (frontmatter.storyline_scene === true || frontmatter.storyline_scene === 'true') {
      let plotgrid: Record<string, string> = {};
      try {
        const pg = await joplin.data.userDataGet(1, note.id, 'storyline_plotgrid');
        if (pg) plotgrid = JSON.parse(pg);
      } catch {}

      scenes.push({
        id: note.id,
        title: stripPrefix(note.title),
        noteTitle: note.title,
        body: note.body,
        frontmatter,
        content,
        wordCount: wordCount(content),
        plotgrid,
      });
    } else {
      let type: string | null = null;
      if (frontmatter.storyline_codex) type = String(frontmatter.storyline_codex);
      else if (frontmatter.storyline_character === true || frontmatter.storyline_character === 'true') type = 'character';
      else if (frontmatter.storyline_location === true || frontmatter.storyline_location === 'true') type = 'location';

      if (type) {
        if (!codex[type]) codex[type] = [];
        let aliases: string[] = [];
        if (frontmatter.aliases) {
          if (Array.isArray(frontmatter.aliases)) {
            aliases = frontmatter.aliases.map((a: any) => String(a).trim()).filter(Boolean);
          } else if (typeof frontmatter.aliases === 'string') {
            aliases = frontmatter.aliases.split(',').map((a: string) => a.trim()).filter(Boolean);
          }
        }
        codex[type].push({
          id: note.id,
          title: stripPrefix(note.title),
          noteTitle: note.title,
          body: note.body,
          frontmatter,
          aliases,
        });
      }
    }
  }

  const characters = codex['character'] || [];
  const locations = codex['location'] || [];
  const customCodex: Record<string, any[]> = {};
  for (const [key, items] of Object.entries(codex)) {
    if (key !== 'character' && key !== 'location') customCodex[key] = items;
  }

  return { config, scenes, characters, locations, customCodex };
}

// ── Plotline operations ─────────────────────────────────────────────

async function removePlotlineFromScenes(folderId: string, plotlineName: string) {
  const allNotes = await getFolderNotes(folderId);
  for (const note of allNotes) {
    if (note.title === CONFIG_TITLE) continue;
    const { frontmatter, content } = parseFrontmatter(note.body);
    if (frontmatter.storyline_scene !== true && frontmatter.storyline_scene !== 'true') continue;

    let changed = false;
    if (Array.isArray(frontmatter.plotlines)) {
      const idx = frontmatter.plotlines.indexOf(plotlineName);
      if (idx !== -1) {
        frontmatter.plotlines.splice(idx, 1);
        changed = true;
      }
    }
    if (changed) {
      const newBody = stringifyFrontmatter(frontmatter) + content;
      await joplin.data.put(['notes', note.id], null, { body: newBody });
    }
    try {
      const pgStr = await joplin.data.userDataGet(1, note.id, 'storyline_plotgrid');
      if (pgStr) {
        const plotgrid = JSON.parse(pgStr);
        if (plotgrid[plotlineName] !== undefined) {
          delete plotgrid[plotlineName];
          await joplin.data.userDataSet(1, note.id, 'storyline_plotgrid', JSON.stringify(plotgrid));
        }
      }
    } catch {}
  }
}

async function renamePlotlineInScenes(folderId: string, oldName: string, newName: string) {
  const allNotes = await getFolderNotes(folderId);
  for (const note of allNotes) {
    if (note.title === CONFIG_TITLE) continue;
    const { frontmatter, content } = parseFrontmatter(note.body);
    if (frontmatter.storyline_scene !== true && frontmatter.storyline_scene !== 'true') continue;

    let changed = false;
    if (Array.isArray(frontmatter.plotlines)) {
      const idx = frontmatter.plotlines.indexOf(oldName);
      if (idx !== -1) {
        frontmatter.plotlines[idx] = newName;
        changed = true;
      }
    }
    if (changed) {
      const newBody = stringifyFrontmatter(frontmatter) + content;
      await joplin.data.put(['notes', note.id], null, { body: newBody });
    }
    try {
      const pgStr = await joplin.data.userDataGet(1, note.id, 'storyline_plotgrid');
      if (pgStr) {
        const plotgrid = JSON.parse(pgStr);
        if (plotgrid[oldName] !== undefined) {
          plotgrid[newName] = plotgrid[oldName];
          delete plotgrid[oldName];
          await joplin.data.userDataSet(1, note.id, 'storyline_plotgrid', JSON.stringify(plotgrid));
        }
      }
    } catch {}
  }
}

// ── Plugin registration ─────────────────────────────────────────────

joplin.plugins.register({
  onStart: async function() {
    let panel: any;
    let panelVisible = true;

    try {
      panel = await joplin.views.panels.create('storyline.panel');
    } catch (e) {
      console.error('StoryLine: failed to create panel', e);
      return;
    }

    try {
      await joplin.views.panels.setHtml(panel, `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>StoryLine</title></head>
<body>
  <div id="app">
    <header>
      <div class="toolbar">
        <select id="project-select"><option>Loading projects...</option></select>
        <button id="new-project-btn" title="New Project">+ Project</button>
        <button id="adopt-btn" title="Adopt the notebook of the currently selected note as a StoryLine project">&#x1F4C2; Adopt Notebook</button>
        <nav id="view-tabs">
          <button data-view="board" class="active">Board</button>
          <button data-view="plotgrid">Plotgrid</button>
          <button data-view="timeline">Timeline</button>
          <button data-view="codex">Codex</button>
        </nav>
        <button id="new-scene-btn" title="New Scene">+ Scene</button>
        <button id="refresh-btn" title="Refresh">&#x21bb;</button>
      </div>
    </header>
    <div class="workspace">
      <main id="main-view"><div class="loading">Loading StoryLine...</div></main>
      <aside id="inspector">
        <h3>Inspector</h3>
        <div id="inspector-content">Select a scene or codex entry to edit metadata.</div>
      </aside>
    </div>
  </div>
</body>
</html>`);
      await joplin.views.panels.addScript(panel, './webview.css');
      await joplin.views.panels.addScript(panel, './webview.js');
    } catch (e) {
      console.error('StoryLine: failed to init panel', e);
      return;
    }

    try {
      await joplin.views.panels.onMessage(panel, async (msg: any) => {
        try {
          if (msg.name === 'getProjects') {
            return await findProjects();
          }

          if (msg.name === 'getProjectData') {
            return await getProjectData(msg.folderId);
          }

          if (msg.name === 'createProject') {
            const folder = await joplin.data.post(['folders'], null, {
              title: msg.projectName || 'My Novel',
            });
            const configBody = JSON.stringify(normalizeConfig({
              plotlines: ['Main Plot'],
              projectName: msg.projectName || 'My Novel',
            }));
            const note = await joplin.data.post(['notes'], null, {
              title: CONFIG_TITLE,
              body: configBody,
              parent_id: folder.id,
            });
            return { folderId: folder.id, configNoteId: note.id };
          }

          if (msg.name === 'adoptCurrentNotebook') {
            return await adoptCurrentNotebook();
          }

          if (msg.name === 'updateScene') {
            const note = await joplin.data.get(['notes', msg.id], { fields: NOTE_FIELDS });
            const { content } = parseFrontmatter(note.body);
            const newFm = msg.frontmatter || {};

            let plotgrid: Record<string, string> = {};
            try {
              const pgStr = await joplin.data.userDataGet(1, msg.id, 'storyline_plotgrid');
              if (pgStr) plotgrid = JSON.parse(pgStr);
            } catch {}

            const plotlinesArr: string[] = Array.isArray(newFm.plotlines) ? [...newFm.plotlines] : [];

            if (msg.plotgrid) {
              for (const [pl, val] of Object.entries(msg.plotgrid)) {
                const strVal = String(val || '').trim();
                if (strVal) {
                  plotgrid[pl] = strVal;
                  if (!plotlinesArr.includes(pl)) plotlinesArr.push(pl);
                } else {
                  delete plotgrid[pl];
                  const idx = plotlinesArr.indexOf(pl);
                  if (idx !== -1) plotlinesArr.splice(idx, 1);
                }
              }
            }

            for (const pl of Object.keys(plotgrid)) {
              if (plotgrid[pl] && plotgrid[pl].trim() && !plotlinesArr.includes(pl)) {
                plotlinesArr.push(pl);
              }
            }

            newFm.plotlines = plotlinesArr;

            const displayTitle = msg.title || stripPrefix(note.title);
            const joplinTitle = sceneNoteTitle(displayTitle, newFm.act, newFm.chapter);

            const newBody = stringifyFrontmatter(newFm) + content;
            await joplin.data.put(['notes', msg.id], null, {
              body: newBody,
              title: joplinTitle,
            });

            try {
              await joplin.data.userDataSet(1, msg.id, 'storyline_plotgrid', JSON.stringify(plotgrid));
            } catch {}

            return { success: true };
          }

          if (msg.name === 'updateEntity') {
            const note = await joplin.data.get(['notes', msg.id], { fields: NOTE_FIELDS });
            const { content, frontmatter: oldFm } = parseFrontmatter(note.body);
            const newFm = msg.frontmatter || {};
            const newBody = stringifyFrontmatter(newFm) + content;

            const typeKey = newFm.storyline_codex || oldFm.storyline_codex || 'unknown';

            let codexTypes: any[] = [];
            try {
              if (msg.folderId) {
                const allNotes = await getFolderNotes(msg.folderId);
                const cfgNote = allNotes.find((n: any) => n.title === CONFIG_TITLE);
                if (cfgNote) {
                  const cfg = JSON.parse(cfgNote.body || '{}');
                  codexTypes = cfg.codexTypes || [];
                }
              }
            } catch {}

            const displayTitle = msg.title || stripPrefix(note.title);
            const joplinTitle = entityNoteTitle(displayTitle, typeKey, codexTypes);

            await joplin.data.put(['notes', msg.id], null, {
              body: newBody,
              title: joplinTitle,
            });
            return { success: true };
          }

          if (msg.name === 'updateConfig') {
            const notes = await getFolderNotes(msg.folderId);
            const configNote = notes.find((n: any) => n.title === CONFIG_TITLE);
            if (!configNote) return { error: 'No config note' };
            let existing: any = {};
            try { existing = JSON.parse(configNote.body || '{}'); } catch {}
            const merged = Object.assign({}, existing, msg.config);
            await joplin.data.put(['notes', configNote.id], null, { body: JSON.stringify(merged) });
            return {};
          }

          if (msg.name === 'deletePlotline') {
            const notes = await getFolderNotes(msg.folderId);
            const configNote = notes.find((n: any) => n.title === CONFIG_TITLE);
            if (!configNote) return { error: 'No config note' };
            let config: any = {};
            try { config = JSON.parse(configNote.body || '{}'); } catch {}
            config = normalizeConfig(config);
            config.plotlines = (config.plotlines || []).filter((p: string) => p !== msg.plotlineName);
            if (config.plotlineColors) delete config.plotlineColors[msg.plotlineName];
            await joplin.data.put(['notes', configNote.id], null, { body: JSON.stringify(config) });
            await removePlotlineFromScenes(msg.folderId, msg.plotlineName);
            return { success: true };
          }

          if (msg.name === 'renamePlotline') {
            const notes = await getFolderNotes(msg.folderId);
            const configNote = notes.find((n: any) => n.title === CONFIG_TITLE);
            if (!configNote) return { error: 'No config note' };
            let config: any = {};
            try { config = JSON.parse(configNote.body || '{}'); } catch {}
            config = normalizeConfig(config);
            const idx = (config.plotlines || []).indexOf(msg.oldName);
            if (idx !== -1) config.plotlines[idx] = msg.newName;
            if (config.plotlineColors && config.plotlineColors[msg.oldName]) {
              config.plotlineColors[msg.newName] = config.plotlineColors[msg.oldName];
              delete config.plotlineColors[msg.oldName];
            }
            await joplin.data.put(['notes', configNote.id], null, { body: JSON.stringify(config) });
            await renamePlotlineInScenes(msg.folderId, msg.oldName, msg.newName);
            return { success: true };
          }

          if (msg.name === 'openNote') {
            await joplin.commands.execute('openNote', msg.id);
            return {};
          }

          if (msg.name === 'createScene') {
            const displayTitle = msg.title || 'New Scene';
            const fm: Record<string, any> = {
              storyline_scene: true,
              status: 'Idea',
              act: 1,
              chapter: 1,
              pov: '',
              location: '',
              date: '',
              time: '',
              plotlines: [],
            };
            const body = stringifyFrontmatter(fm) + '\n\n';
            const joplinTitle = sceneNoteTitle(displayTitle, fm.act, fm.chapter);
            const note = await joplin.data.post(['notes'], null, {
              title: joplinTitle,
              body,
              parent_id: msg.folderId,
            });
            return { id: note.id };
          }

          if (msg.name === 'createEntity') {
            const fm: Record<string, any> = {};
            if (msg.type === 'character' || msg.type === 'location') {
              if (msg.type === 'character') fm.storyline_character = true;
              if (msg.type === 'location') fm.storyline_location = true;
            }
            fm.storyline_codex = msg.type;
            fm.aliases = '';
            const body = stringifyFrontmatter(fm) + '\n\n';

            let codexTypes: any[] = [];
            try {
              const allNotes = await getFolderNotes(msg.folderId);
              const cfgNote = allNotes.find((n: any) => n.title === CONFIG_TITLE);
              if (cfgNote) {
                const cfg = JSON.parse(cfgNote.body || '{}');
                codexTypes = cfg.codexTypes || [];
              }
            } catch {}

            const joplinTitle = entityNoteTitle(msg.title, msg.type, codexTypes);
            const note = await joplin.data.post(['notes'], null, {
              title: joplinTitle,
              body,
              parent_id: msg.folderId,
            });
            return { id: note.id };
          }

        } catch (e) {
          console.error('StoryLine backend error:', e);
          return { error: String(e) };
        }
        return {};
      });
    } catch (e) {
      console.error('StoryLine: failed to attach message handler', e);
      return;
    }

    try {
      await joplin.commands.register({
        name: 'storyline.open',
        label: 'Open StoryLine',
        iconName: 'fas fa-book-open',
        execute: async () => {
          panelVisible = true;
          await joplin.views.panels.show(panel, true);
        },
      });

      await joplin.commands.register({
        name: 'storyline.toggle',
        label: 'Toggle StoryLine',
        iconName: 'fas fa-book-open',
        execute: async () => {
          panelVisible = !panelVisible;
          await joplin.views.panels.show(panel, panelVisible);
        },
      });

      try {
        await joplin.views.menuItems.create('storyline.toggle.menu', 'storyline.toggle', 'view');
      } catch (menuErr) {
        console.warn('StoryLine: could not add View menu item', menuErr);
      }

      await joplin.views.panels.show(panel, true);
    } catch (e) {
      console.error('StoryLine: failed to register commands', e);
    }
  },
});
