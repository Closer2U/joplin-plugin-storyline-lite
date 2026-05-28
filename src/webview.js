(function() {
  'use strict';

  var state = {
    data: { config: { plotlines: ['Main Plot'], plotlineColors: {}, codexTypes: [], customFields: {} }, scenes: [], characters: [], locations: [], customCodex: {} },
    view: 'board',
    selectedItem: null,
    projectFolderId: null,
    codexTab: null
  };

  var DEFAULT_COLORS = ['#ff6b6b','#4ecdc4','#45b7d1','#96ceb4','#ffeaa7','#fd79a8','#a29bfe','#fab1a0','#f7d794','#778beb'];

  var TYPE_PILL_COLORS = {
    character: '#1a5c3a',
    location: '#7a2828',
    item: '#2a4a7a',
    faction: '#6b3a8a',
    creature: '#5a4a1a',
    event: '#1a5a6a',
    magic: '#6a2a6a',
    ship: '#2a5a5a'
  };

  function el(id) { return document.getElementById(id); }

  function showError(msg) {
    var main = el('main-view');
    if (!main) return;
    var div = document.createElement('div');
    div.style.cssText = 'padding:12px;color:#ff6b6b;background:#2a1a1a;border:1px solid #ff6b6b;border-radius:4px;margin:8px;';
    div.innerHTML = '<strong>Error:</strong> ' + escapeHtml(String(msg));
    main.insertBefore(div, main.firstChild);
    setTimeout(function() { div.remove(); }, 5000);
  }

  function getPlotlineColor(pl) {
    var colors = (state.data.config && state.data.config.plotlineColors) || {};
    if (colors[pl]) return colors[pl];
    var idx = (state.data.config.plotlines || []).indexOf(pl);
    return DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
  }

  function getPillColor(key) {
    var types = (state.data.config && state.data.config.codexTypes) || [];
    var t = types.find(function(x) { return x.key === key; });
    if (t && t.color) return t.color;
    if (TYPE_PILL_COLORS[key]) return TYPE_PILL_COLORS[key];
    return '#3a3a5a';
  }

  function getEntityColor(key) {
    return getPillColor(key);
  }

  /**
   * Normalize text for matching: lowercase and normalize special chars
   * to a canonical form. Apostrophes/quotes are kept as-is so that
   * "Voldemort's" matches "Voldemort's".
   */
  function normalizeForMatch(text) {
    return text.toLowerCase();
  }

  /**
   * Build list of all codex items with their aliases for matching.
   */
  function allCodexItems() {
    var items = [];

    function addItems(list, key) {
      (list || []).forEach(function(c) {
        var aliases = [];
        if (c.aliases) {
          if (Array.isArray(c.aliases)) {
            aliases = c.aliases;
          } else if (typeof c.aliases === 'string') {
            aliases = c.aliases.split(',').map(function(a) { return a.trim(); }).filter(Boolean);
          }
        }
        var matchTerms = [normalizeForMatch(c.title)];
        aliases.forEach(function(a) {
          var lower = normalizeForMatch(a.trim());
          if (lower && matchTerms.indexOf(lower) === -1) matchTerms.push(lower);
        });
        items.push({ id: c.id, title: c.title, key: key, aliases: aliases, matchTerms: matchTerms });
      });
    }

    addItems(state.data.characters, 'character');
    addItems(state.data.locations, 'location');
    var cc = state.data.customCodex || {};
    Object.keys(cc).forEach(function(key) {
      addItems(cc[key], key);
    });

    return items;
  }

  /**
   * Check if a match term appears at position `idx` in `text` with word boundaries.
   * A word boundary is: start/end of string, or a whitespace/punctuation character.
   * We do NOT strip special characters from the text — we check boundaries around
   * the exact match position.
   */
  function hasWordBoundaryAt(text, idx, termLen) {
    // Characters that count as word boundaries
    var boundaryChars = ' \t\n\r.,;:!?()[]{}"-/\\|~#@&*+=<>^`';
    var before = idx === 0 || boundaryChars.indexOf(text.charAt(idx - 1)) !== -1;
    var after = (idx + termLen) >= text.length || boundaryChars.indexOf(text.charAt(idx + termLen)) !== -1;
    return before && after;
  }

  /**
   * Smart matching: find codex items mentioned in text.
   *
   * Key design:
   * - We do NOT strip special characters from the text or terms.
   *   "Voldemort's Lair" stays as-is and matches "voldemort's lair" exactly.
   * - Word boundary detection uses whitespace + punctuation around the match.
   * - Disambiguation: if a term belongs to 2+ items, it's skipped.
   * - Minimum 2-char terms to avoid noise.
   */
  function findMentionedItems(text, codexItems) {
    if (!text || !text.trim()) return [];
    var lowerText = normalizeForMatch(text);
    var matched = {};
    var termToItems = {};

    // Build disambiguation map
    codexItems.forEach(function(item) {
      item.matchTerms.forEach(function(term) {
        if (term.length < 2) return;
        if (!termToItems[term]) termToItems[term] = [];
        if (termToItems[term].indexOf(item.id) === -1) {
          termToItems[term].push(item.id);
        }
      });
    });

    codexItems.forEach(function(item) {
      if (matched[item.id]) return;
      for (var i = 0; i < item.matchTerms.length; i++) {
        var term = item.matchTerms[i];
        if (term.length < 2) continue;

        // Skip ambiguous terms
        if (termToItems[term] && termToItems[term].length > 1) continue;

        // Search for the term in the text (may appear multiple times)
        var searchFrom = 0;
        while (searchFrom < lowerText.length) {
          var idx = lowerText.indexOf(term, searchFrom);
          if (idx === -1) break;

          if (hasWordBoundaryAt(lowerText, idx, term.length)) {
            matched[item.id] = item;
            break;
          }
          searchFrom = idx + 1;
        }
        if (matched[item.id]) break;
      }
    });

    var result = [];
    for (var id in matched) {
      if (matched.hasOwnProperty(id)) result.push(matched[id]);
    }
    return result;
  }

  async function init() {
    try {
      if (!window.webviewApi || !window.webviewApi.postMessage) {
        el('main-view').innerHTML = '<div style="padding:20px;color:#ff6b6b;">webviewApi not available.</div>';
        return;
      }
      setupListeners();
      await loadProjects();
    } catch (e) {
      showError('Init failed: ' + (e && e.message ? e.message : String(e)));
    }
  }

  function setupListeners() {
    el('view-tabs').addEventListener('click', function(e) {
      if (e.target && e.target.dataset && e.target.dataset.view) {
        switchView(e.target.dataset.view);
      }
    });
    el('refresh-btn').addEventListener('click', loadData);
    el('new-scene-btn').addEventListener('click', function() {
      if (!state.projectFolderId) { showError('Create or select a project first.'); return; }
      toggleSceneForm();
    });
    el('new-project-btn').addEventListener('click', showNewProjectForm);
    el('adopt-btn').addEventListener('click', adoptCurrentNotebook);
    el('project-select').addEventListener('change', function(e) {
      state.projectFolderId = e.target.value || null;
      state.selectedItem = null;
      loadData();
    });
  }

  async function adoptCurrentNotebook() {
    try {
      var res = await webviewApi.postMessage({ name: 'adoptCurrentNotebook' });
      if (res && res.error) {
        showError(res.error);
        return;
      }
      if (res && res.folderId) {
        state.projectFolderId = res.folderId;
        if (res.alreadyExisted) {
          showError('Notebook "' + (res.name || 'Unknown') + '" is already a StoryLine project. Loaded it.');
        }
        await loadProjects();
      } else {
        showError('Could not adopt notebook. Select a note in Joplin first.');
      }
    } catch (e) {
      showError('Adopt failed: ' + (e && e.message ? e.message : String(e)));
    }
  }

  function showNewProjectForm() {
    var main = el('main-view');
    if (!main) return;
    main.innerHTML = '';
    var box = document.createElement('div');
    box.style.cssText = 'padding:40px;text-align:center;';
    box.innerHTML = '<h2 style="margin-bottom:16px;">Create a StoryLine Project</h2>' +
      '<p style="color:#888;">Enter a name for your new project notebook.</p>';
    var inputWrap = document.createElement('div');
    inputWrap.style.cssText = 'margin-top:12px;';
    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'new-project-name';
    input.placeholder = 'e.g. My Novel';
    input.style.cssText = 'padding:8px 12px;background:#1e1e1e;color:#d4d4d4;border:1px solid #333;border-radius:4px;width:240px;';
    var btn = document.createElement('button');
    btn.textContent = 'Create Project';
    btn.style.cssText = 'margin-left:8px;padding:8px 14px;background:#2d8bf5;color:white;border:none;border-radius:4px;cursor:pointer;';
    btn.addEventListener('click', async function() {
      try {
        var name = el('new-project-name').value.trim();
        if (!name) { showError('Enter a project name'); return; }
        var res = await webviewApi.postMessage({ name: 'createProject', projectName: name });
        if (res && res.folderId) {
          state.projectFolderId = res.folderId;
          await loadProjects();
        } else {
          showError('Project creation failed');
        }
      } catch (e) {
        showError('Create project failed: ' + (e && e.message ? e.message : String(e)));
      }
    });
    inputWrap.appendChild(input);
    inputWrap.appendChild(btn);
    box.appendChild(inputWrap);
    main.appendChild(box);
    input.focus();
  }

  function toggleSceneForm() {
    var existing = el('scene-form');
    if (existing) { existing.remove(); return; }
    var form = document.createElement('div');
    form.id = 'scene-form';
    form.style.cssText = 'padding:10px;background:#252526;border:1px solid #333;border-radius:4px;margin-bottom:10px;';
    form.innerHTML = '<label style="font-size:12px;color:#aaa;">New scene title</label><br>' +
      '<input type="text" id="new-scene-title" placeholder="e.g. The Meeting" style="width:200px;padding:4px;background:#1e1e1e;color:#d4d4d4;border:1px solid #333;border-radius:4px;">' +
      '<button id="new-scene-submit" style="margin-left:8px;padding:4px 10px;background:#2d8bf5;color:white;border:none;border-radius:4px;cursor:pointer;">Create</button>' +
      '<button id="new-scene-cancel" style="margin-left:4px;padding:4px 10px;background:#333;color:#aaa;border:none;border-radius:4px;cursor:pointer;">Cancel</button>';
    el('main-view').insertBefore(form, el('main-view').firstChild);
    el('new-scene-submit').addEventListener('click', function() {
      var title = el('new-scene-title').value.trim();
      if (title) createScene(title);
      form.remove();
    });
    el('new-scene-cancel').addEventListener('click', function() { form.remove(); });
    el('new-scene-title').focus();
  }

  async function loadProjects() {
    try {
      var projects = await webviewApi.postMessage({ name: 'getProjects' });
      var sel = el('project-select');
      sel.innerHTML = '';
      if (!projects || !Array.isArray(projects) || projects.length === 0) {
        state.projectFolderId = null;
        var opt = document.createElement('option');
        opt.textContent = 'No project \u2014 click + Project';
        sel.appendChild(opt);
        renderNoProject();
      } else {
        projects.forEach(function(p) {
          var opt = document.createElement('option');
          opt.value = p.folderId;
          opt.textContent = p.name || 'Project';
          sel.appendChild(opt);
        });
        if (!state.projectFolderId || !projects.some(function(p) { return p.folderId === state.projectFolderId; })) {
          state.projectFolderId = projects[0].folderId;
        }
        sel.value = state.projectFolderId;
        await loadData();
      }
    } catch (e) {
      showError('Failed to load projects: ' + (e && e.message ? e.message : String(e)));
    }
  }

  function renderNoProject() {
    var main = el('main-view');
    if (!main) return;
    main.innerHTML = '';
    var box = document.createElement('div');
    box.style.cssText = 'padding:40px;text-align:center;';
    box.innerHTML = '<h2 style="margin-bottom:16px;">No StoryLine project found</h2>' +
      '<p style="color:#888;margin-bottom:12px;">Click <strong>+ Project</strong> to create a new project notebook.</p>' +
      '<p style="color:#888;">Or select any note inside an existing notebook and click<br><strong>\uD83D\uDCC2 Adopt Notebook</strong> to use it as a project.</p>' +
      '<p style="color:#666;font-size:11px;margin-top:16px;">Adopt works with any notebook at any depth in your Joplin folder tree.<br>If it already has a StoryLine Config note, it will be loaded as-is.</p>';
    main.appendChild(box);
  }

  async function loadData() {
    if (!state.projectFolderId) { renderNoProject(); return; }
    var main = el('main-view');
    if (main) main.innerHTML = '<div class="loading">Loading...</div>';
    try {
      var result = await webviewApi.postMessage({ name: 'getProjectData', folderId: state.projectFolderId });
      if (result && result.error) { showError('Backend error: ' + result.error); renderNoProject(); return; }
      state.data = result || { config: { plotlines: ['Main Plot'] }, scenes: [], characters: [], locations: [] };

      if (state.selectedItem) {
        var stillExists = false;
        if (state.selectedItem.type === 'scene') {
          stillExists = (state.data.scenes || []).some(function(s) { return s.id === state.selectedItem.id; });
        } else {
          var lists = [state.data.characters, state.data.locations].concat(Object.values(state.data.customCodex || {}));
          stillExists = lists.some(function(list) {
            return (list || []).some(function(x) { return x.id === state.selectedItem.id; });
          });
        }
        if (!stillExists) state.selectedItem = null;
      }

      if (!state.codexTab) {
        var types = (state.data.config && state.data.config.codexTypes) || [];
        state.codexTab = (types[0] && types[0].key) || 'character';
      }
      render();
    } catch (e) {
      showError('Failed to load data: ' + (e && e.message ? e.message : String(e)));
      renderNoProject();
    }
  }

  function switchView(view) {
    state.view = view;
    document.querySelectorAll('#view-tabs button').forEach(function(b) {
      if (b.classList) b.classList.toggle('active', b.dataset.view === view);
    });
    render();
  }

  function render() {
    try {
      var main = el('main-view');
      if (!main) return;
      main.innerHTML = '';
      if (!state.projectFolderId) { renderNoProject(); return; }
      if (state.view === 'board') renderBoard(main);
      else if (state.view === 'plotgrid') renderPlotgrid(main);
      else if (state.view === 'timeline') renderTimeline(main);
      else if (state.view === 'codex') renderCodex(main);
      renderInspector();
    } catch (e) {
      showError('Render failed: ' + (e && e.message ? e.message : String(e)));
    }
  }

  function renderBoard(container) {
    var statuses = ['Idea', 'Outline', 'Draft', 'Revised', 'Done'];
    var grid = document.createElement('div');
    grid.className = 'board';

    statuses.forEach(function(status) {
      var col = document.createElement('div');
      col.className = 'board-col';
      col.dataset.status = status;
      var header = document.createElement('div');
      header.className = 'col-header';
      var scenes = (state.data.scenes || []).filter(function(s) {
        return ((s.frontmatter && s.frontmatter.status) || 'Idea') === status;
      });
      header.innerHTML = escapeHtml(status) + ' <span class="count">' + scenes.length + '</span>';
      col.appendChild(header);
      scenes.forEach(function(scene) { col.appendChild(createSceneCard(scene)); });
      col.addEventListener('dragover', function(e) { e.preventDefault(); });
      col.addEventListener('drop', function(e) {
        e.preventDefault();
        var id = e.dataTransfer.getData('text/plain');
        if (id) updateSceneStatus(id, status);
      });
      grid.appendChild(col);
    });

    container.appendChild(grid);

    if ((state.data.scenes || []).length === 0) {
      var hint = document.createElement('div');
      hint.style.cssText = 'padding:12px;color:#888;font-size:12px;text-align:center;';
      hint.textContent = 'No scenes yet. Click + Scene to create one.';
      container.insertBefore(hint, container.firstChild);
    }
  }

  function createSceneCard(scene) {
    var card = document.createElement('div');
    card.className = 'scene-card';
    card.draggable = true;
    card.dataset.id = scene.id;
    var fm = scene.frontmatter || {};
    var locHtml = fm.location ? '<div class="card-loc">\uD83D\uDCCD ' + escapeHtml(String(fm.location)) + '</div>' : '';
    var plotlineDots = '';
    var pls = fm.plotlines || [];
    if (Array.isArray(pls) && pls.length > 0) {
      plotlineDots = '<div class="card-plotlines" style="display:flex;gap:3px;margin-top:4px;">' +
        pls.map(function(pl) {
          var c = getPlotlineColor(pl);
          return '<span style="width:8px;height:8px;border-radius:50%;background:' + c + ';display:inline-block;" title="' + escapeHtml(pl) + '"></span>';
        }).join('') + '</div>';
    }
    card.innerHTML =
      '<div class="card-title">' + escapeHtml(scene.title || 'Untitled') + '</div>' +
      '<div class="card-meta">' +
        '<span class="badge">' + (fm.act || '') + '.' + (fm.chapter || '') + '</span>' +
        '<span>' + escapeHtml(String(fm.pov || '')) + '</span>' +
        '<span>' + (scene.wordCount || 0) + 'w</span>' +
      '</div>' + locHtml + plotlineDots;
    card.addEventListener('click', function() { selectItem({ id: scene.id, type: 'scene' }); });
    card.addEventListener('dragstart', function(e) { e.dataTransfer.setData('text/plain', scene.id); });
    return card;
  }

  async function updateSceneStatus(id, status) {
    try {
      var scene = (state.data.scenes || []).find(function(s) { return s.id === id; });
      if (!scene) return;
      if (!scene.frontmatter) scene.frontmatter = {};
      scene.frontmatter.status = status;
      await webviewApi.postMessage({ name: 'updateScene', id: id, frontmatter: scene.frontmatter, title: scene.title });
      loadData();
    } catch (e) {
      showError('Update status failed: ' + (e && e.message ? e.message : String(e)));
    }
  }

  function renderPlotgrid(container) {
    var plotlines = (state.data.config && state.data.config.plotlines) || ['Main Plot'];
    var wrapper = document.createElement('div');
    wrapper.className = 'plotgrid-wrapper';

    // --- Toolbar: add plotline ---
    var tools = document.createElement('div');
    tools.className = 'plotgrid-tools';
    tools.innerHTML = '<input type="text" id="new-plotline-name" placeholder="Plotline name" style="padding:4px 8px;background:#1e1e1e;color:#d4d4d4;border:1px solid #333;border-radius:4px;">' +
      '<button id="add-plotline" style="margin-left:6px;padding:4px 10px;background:#2d8bf5;color:white;border:none;border-radius:4px;cursor:pointer;">+ Plotline</button>';
    tools.querySelector('#add-plotline').addEventListener('click', async function() {
      try {
        var name = el('new-plotline-name').value.trim();
        if (name && plotlines.indexOf(name) === -1) {
          plotlines.push(name);
          if (!state.data.config) state.data.config = {};
          state.data.config.plotlines = plotlines;
          state.data.config.plotlineColors = state.data.config.plotlineColors || {};
          state.data.config.plotlineColors[name] = DEFAULT_COLORS[plotlines.length % DEFAULT_COLORS.length];
          await webviewApi.postMessage({ name: 'updateConfig', folderId: state.projectFolderId, config: state.data.config });
          loadData();
        }
      } catch (e) {
        showError('Add plotline failed: ' + (e && e.message ? e.message : String(e)));
      }
    });
    wrapper.appendChild(tools);

    if ((state.data.scenes || []).length === 0) {
      var hint = document.createElement('div');
      hint.style.cssText = 'padding:12px;color:#888;';
      hint.textContent = 'No scenes yet. Switch to Board view and click + Scene to create one.';
      wrapper.appendChild(hint);
      container.appendChild(wrapper);
      return;
    }

    var codexItems = allCodexItems();

    var table = document.createElement('table');
    table.className = 'plotgrid';
    var thead = document.createElement('thead');
    var tr = document.createElement('tr');
    var thScene = document.createElement('th');
    thScene.textContent = 'Scene';
    tr.appendChild(thScene);

    plotlines.forEach(function(pl) {
      var th = document.createElement('th');
      var color = getPlotlineColor(pl);
      th.style.cssText = 'background:' + color + ';color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.4);position:relative;';

      // Plotline name (editable on double-click)
      var nameSpan = document.createElement('span');
      nameSpan.textContent = pl;
      nameSpan.title = 'Double-click to rename';
      nameSpan.style.cssText = 'cursor:default;';
      th.appendChild(nameSpan);

      // Delete button
      if (plotlines.length > 1) {
        var delBtn = document.createElement('span');
        delBtn.textContent = '\u00d7';
        delBtn.title = 'Delete plotline "' + pl + '"';
        delBtn.style.cssText = 'cursor:pointer;margin-left:8px;font-weight:bold;opacity:0.7;font-size:14px;';
        delBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (confirm('Delete plotline "' + pl + '"?\n\nThis will remove it from all scenes and delete all plotgrid content for this plotline.')) {
            webviewApi.postMessage({ name: 'deletePlotline', folderId: state.projectFolderId, plotlineName: pl }).then(function() {
              loadData();
            }).catch(function(err) {
              showError('Delete plotline failed: ' + (err && err.message ? err.message : String(err)));
            });
          }
        });
        th.appendChild(delBtn);
      }

      // Rename on double-click
      nameSpan.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        var currentName = pl;
        var input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.style.cssText = 'width:100px;padding:2px 4px;background:#1e1e1e;color:#d4d4d4;border:1px solid #555;border-radius:3px;font-size:12px;';
        nameSpan.textContent = '';
        nameSpan.appendChild(input);
        input.focus();
        input.select();

        function finishRename() {
          var newName = input.value.trim();
          if (!newName || newName === currentName) {
            nameSpan.textContent = currentName;
            return;
          }
          // Check for duplicates
          if (plotlines.indexOf(newName) !== -1) {
            showError('A plotline named "' + newName + '" already exists.');
            nameSpan.textContent = currentName;
            return;
          }
          nameSpan.textContent = newName + ' ...';
          webviewApi.postMessage({ name: 'renamePlotline', folderId: state.projectFolderId, oldName: currentName, newName: newName }).then(function() {
            loadData();
          }).catch(function(err) {
            showError('Rename plotline failed: ' + (err && err.message ? err.message : String(err)));
            loadData();
          });
        }

        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', function(ke) {
          if (ke.key === 'Enter') { input.blur(); }
          if (ke.key === 'Escape') { nameSpan.textContent = currentName; }
        });
      });

      tr.appendChild(th);
    });

    thead.appendChild(tr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    var scenes = (state.data.scenes || []).slice().sort(function(a, b) {
      var aAct = parseInt(a.frontmatter && a.frontmatter.act) || 0;
      var bAct = parseInt(b.frontmatter && b.frontmatter.act) || 0;
      var aCh = parseInt(a.frontmatter && a.frontmatter.chapter) || 0;
      var bCh = parseInt(b.frontmatter && b.frontmatter.chapter) || 0;
      if (aAct !== bAct) return aAct - bAct;
      return aCh - bCh;
    });

    scenes.forEach(function(scene) {
      var tr = document.createElement('tr');
      var titleTd = document.createElement('td');
      var fm = scene.frontmatter || {};
      titleTd.innerHTML = '<strong>' + escapeHtml(scene.title || 'Untitled') + '</strong><br><small>Act ' + (fm.act || '') + ' \u2022 Ch ' + (fm.chapter || '') + '</small>';
      titleTd.className = 'scene-title-cell';
      titleTd.addEventListener('click', function() { selectItem({ id: scene.id, type: 'scene' }); });
      tr.appendChild(titleTd);

      plotlines.forEach(function(pl) {
        var td = document.createElement('td');
        var color = getPlotlineColor(pl);
        var pg = scene.plotgrid || {};
        var val = pg[pl] || '';

        if (!val.trim()) {
          td.className = 'plotgrid-cell cell-empty';
          td.style.cssText = 'background:#1a1a1a;border:1px dashed #444;';
        } else {
          td.className = 'plotgrid-cell cell-filled';
          td.style.cssText = 'border-left:3px solid ' + color + ';background:rgba(' + hexToRgb(color) + ',0.06);';
        }

        var textDiv = document.createElement('div');
        textDiv.contentEditable = true;
        textDiv.className = 'cell-text';
        textDiv.textContent = val;

        textDiv.addEventListener('blur', async function() {
          try {
            var newVal = textDiv.textContent.trim();
            if (newVal !== (pg[pl] || '').trim()) {
              if (!scene.plotgrid) scene.plotgrid = {};
              scene.plotgrid[pl] = newVal;
              await webviewApi.postMessage({
                name: 'updateScene',
                id: scene.id,
                frontmatter: scene.frontmatter || {},
                plotgrid: scene.plotgrid
              });
            }
            loadData();
          } catch (e) {
            showError('Save plotgrid failed: ' + (e && e.message ? e.message : String(e)));
          }
        });

        td.appendChild(textDiv);

        // Smart codex matching with aliases
        var mentioned = findMentionedItems(val, codexItems);
        if (mentioned.length > 0) {
          var pillsDiv = document.createElement('div');
          pillsDiv.className = 'cell-pills';
          mentioned.forEach(function(ent) {
            var pill = document.createElement('span');
            pill.className = 'pill';
            pill.style.background = getPillColor(ent.key);
            pill.style.color = '#fff';
            pill.textContent = ent.title;
            pillsDiv.appendChild(pill);
          });
          td.appendChild(pillsDiv);
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);
  }

  function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? parseInt(result[1],16)+','+parseInt(result[2],16)+','+parseInt(result[3],16) : '128,128,128';
  }

  function renderTimeline(container) {
    var wrapper = document.createElement('div');
    wrapper.className = 'timeline';
    var scenes = (state.data.scenes || []).slice().sort(function(a, b) {
      var aDate = (a.frontmatter && a.frontmatter.date) || '';
      var bDate = (b.frontmatter && b.frontmatter.date) || '';
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return ((a.frontmatter && a.frontmatter.time) || '').localeCompare((b.frontmatter && b.frontmatter.time) || '');
    });

    if (scenes.length === 0) {
      var hint = document.createElement('div');
      hint.style.cssText = 'padding:12px;color:#888;';
      hint.textContent = 'No scenes yet. Switch to Board view and click + Scene to create one.';
      wrapper.appendChild(hint);
    }

    scenes.forEach(function(scene) {
      var row = document.createElement('div');
      row.className = 'timeline-row';
      var fm = scene.frontmatter || {};
      var dt = (fm.date || '') + ' ' + (fm.time || '');
      row.innerHTML =
        '<div class="tl-date">' + escapeHtml(dt.trim()) + '</div>' +
        '<div class="tl-card" data-id="' + escapeHtml(scene.id) + '">' +
          '<div class="tl-title">' + escapeHtml(scene.title || 'Untitled') + '</div>' +
          '<div class="tl-meta">Act ' + (fm.act || '') + ' \u2022 ' + escapeHtml(String(fm.pov || '')) + ' \u2022 ' + escapeHtml(String(fm.location || '')) + ' \u2022 ' + (scene.wordCount || 0) + 'w</div>' +
        '</div>';
      var card = row.querySelector('.tl-card');
      if (card) card.addEventListener('click', function() { selectItem({ id: scene.id, type: 'scene' }); });
      wrapper.appendChild(row);
    });

    container.appendChild(wrapper);
  }

  function renderCodex(container) {
    var wrapper = document.createElement('div');
    wrapper.className = 'codex';

    var types = (state.data.config && state.data.config.codexTypes) || [
      { key: 'character', label: 'Characters' },
      { key: 'location', label: 'Locations' }
    ];

    var toolbar = document.createElement('div');
    toolbar.className = 'codex-toolbar';
    var toggleBtn = document.createElement('button');
    toggleBtn.textContent = '\u2699 Types';
    toggleBtn.style.cssText = 'padding:4px 8px;background:#333;color:#aaa;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
    toolbar.appendChild(toggleBtn);
    wrapper.appendChild(toolbar);

    var managePanel = document.createElement('div');
    managePanel.style.cssText = 'display:none;margin-bottom:10px;';
    managePanel.innerHTML = '<div style="font-size:12px;color:#888;margin-bottom:6px;">Manage Codex Types</div>';

    var typeList = document.createElement('div');
    typeList.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;';
    types.forEach(function(t) {
      var tag = document.createElement('span');
      var tColor = getEntityColor(t.key);
      tag.style.cssText = 'font-size:12px;padding:3px 8px;background:' + tColor + ';color:#fff;border:1px solid ' + tColor + ';border-radius:4px;display:flex;align-items:center;gap:4px;';
      tag.textContent = t.label;
      if (types.length > 1) {
        var rm = document.createElement('span');
        rm.textContent = '\u00d7';
        rm.style.cssText = 'cursor:pointer;color:#ffaaaa;font-weight:bold;';
        rm.addEventListener('click', async function() {
          var newTypes = types.filter(function(x) { return x.key !== t.key; });
          state.data.config.codexTypes = newTypes;
          await webviewApi.postMessage({ name: 'updateConfig', folderId: state.projectFolderId, config: state.data.config });
          loadData();
        });
        tag.appendChild(rm);
      }
      typeList.appendChild(tag);
    });
    managePanel.appendChild(typeList);

    var addWrap = document.createElement('div');
    addWrap.style.cssText = 'display:flex;gap:6px;';
    var addInput = document.createElement('input');
    addInput.placeholder = 'New type name';
    addInput.style.cssText = 'flex:1;padding:4px 8px;background:#1e1e1e;color:#d4d4d4;border:1px solid #333;border-radius:4px;';
    var addBtn = document.createElement('button');
    addBtn.textContent = 'Add';
    addBtn.style.cssText = 'padding:4px 10px;background:#2d8bf5;color:white;border:none;border-radius:4px;cursor:pointer;';
    addBtn.addEventListener('click', async function() {
      var name = addInput.value.trim();
      if (!name) return;
      var key = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (!key) return;
      if (types.some(function(t) { return t.key === key; })) { showError('Type already exists'); return; }
      var darkColors = ['#2b5a8a', '#6b3a8a', '#3a6b4a', '#8a5a2b', '#5a2b4a', '#2b6a6a', '#6a4a2a', '#4a2a6a'];
      var newColor = darkColors[types.length % darkColors.length];
      types.push({ key: key, label: name, color: newColor });
      state.data.config.codexTypes = types;
      await webviewApi.postMessage({ name: 'updateConfig', folderId: state.projectFolderId, config: state.data.config });
      addInput.value = '';
      loadData();
    });
    addWrap.appendChild(addInput);
    addWrap.appendChild(addBtn);
    managePanel.appendChild(addWrap);
    wrapper.appendChild(managePanel);

    toggleBtn.addEventListener('click', function() {
      managePanel.style.display = managePanel.style.display === 'none' ? 'block' : 'none';
    });

    var tabs = document.createElement('div');
    tabs.className = 'codex-tabs';
    types.forEach(function(t) {
      var btn = document.createElement('button');
      btn.dataset.tab = t.key;
      var count = 0;
      if (t.key === 'character') count = (state.data.characters || []).length;
      else if (t.key === 'location') count = (state.data.locations || []).length;
      else count = ((state.data.customCodex || {})[t.key] || []).length;
      btn.textContent = t.label + ' (' + count + ')';
      if (state.codexTab === t.key) {
        btn.className = 'active';
        var tColor = getEntityColor(t.key);
        btn.style.cssText = 'background:' + tColor + ';color:#fff;border-color:' + tColor + ';';
      }
      tabs.appendChild(btn);
    });
    wrapper.appendChild(tabs);

    var content = document.createElement('div');
    content.className = 'codex-content';
    wrapper.appendChild(content);

    function renderList() {
      content.innerHTML = '';
      var items = [];
      if (state.codexTab === 'character') items = state.data.characters || [];
      else if (state.codexTab === 'location') items = state.data.locations || [];
      else items = (state.data.customCodex && state.data.customCodex[state.codexTab]) || [];

      var list = document.createElement('div');
      list.className = 'entity-list';
      var typeColor = getEntityColor(state.codexTab);

      items.forEach(function(item) {
        var card = document.createElement('div');
        card.className = 'entity-card';
        card.style.borderLeftColor = typeColor;
        card.style.borderLeftWidth = '3px';
        var aliasHtml = '';
        if (item.aliases && ((Array.isArray(item.aliases) && item.aliases.length > 0) || (typeof item.aliases === 'string' && item.aliases.trim()))) {
          var aliasArr = Array.isArray(item.aliases) ? item.aliases : item.aliases.split(',').map(function(a) { return a.trim(); }).filter(Boolean);
          if (aliasArr.length > 0) {
            aliasHtml = '<div style="font-size:10px;color:#888;margin-top:2px;">aka: ' + escapeHtml(aliasArr.join(', ')) + '</div>';
          }
        }
        card.innerHTML = '<div class="entity-title">' + escapeHtml(item.title || 'Untitled') + '</div>' + aliasHtml;
        card.addEventListener('click', function() { selectItem({ id: item.id, type: state.codexTab }); });
        list.appendChild(card);
      });

      var addWrap2 = document.createElement('div');
      addWrap2.style.cssText = 'margin-top:10px;';
      var input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Name';
      input.style.cssText = 'padding:6px 10px;background:#1e1e1e;color:#d4d4d4;border:1px solid #333;border-radius:4px;width:200px;';
      var addBtn2 = document.createElement('button');
      addBtn2.textContent = '+ Add ' + ((types.find(function(t) { return t.key === state.codexTab; }) || {}).label || '');
      addBtn2.style.cssText = 'margin-left:6px;padding:6px 12px;background:#2d8bf5;color:white;border:none;border-radius:4px;cursor:pointer;';
      addBtn2.addEventListener('click', async function() {
        try {
          var title = input.value.trim();
          if (!title) return;
          await webviewApi.postMessage({ name: 'createEntity', type: state.codexTab, title: title, folderId: state.projectFolderId });
          loadData();
        } catch (e) {
          showError('Create entity failed: ' + (e && e.message ? e.message : String(e)));
        }
      });
      addWrap2.appendChild(input);
      addWrap2.appendChild(addBtn2);
      content.appendChild(list);
      content.appendChild(addWrap2);
    }

    tabs.addEventListener('click', function(e) {
      if (e.target && e.target.dataset && e.target.dataset.tab) {
        state.codexTab = e.target.dataset.tab;
        tabs.querySelectorAll('button').forEach(function(b) {
          var isActive = b.dataset.tab === state.codexTab;
          if (b.classList) b.classList.toggle('active', isActive);
          if (isActive) {
            var tColor = getEntityColor(state.codexTab);
            b.style.cssText = 'background:' + tColor + ';color:#fff;border-color:' + tColor + ';';
          } else {
            b.style.cssText = '';
          }
        });
        renderList();
      }
    });

    renderList();
    container.appendChild(wrapper);
  }

  function selectItem(item) {
    state.selectedItem = item;
    renderInspector();
  }

  function renderInspector() {
    try {
      var container = el('inspector-content');
      if (!container) return;
      container.innerHTML = '';
      if (!state.selectedItem) {
        container.textContent = 'Select a scene or codex entry to edit metadata.';
        return;
      }
      if (state.selectedItem.type === 'scene') {
        renderSceneInspector(container);
      } else {
        renderEntityInspector(container, state.selectedItem.type);
      }
    } catch (e) {
      showError('Inspector render failed: ' + (e && e.message ? e.message : String(e)));
    }
  }

  function renderSceneInspector(container) {
    var scene = (state.data.scenes || []).find(function(s) { return s.id === state.selectedItem.id; });
    if (!scene) {
      container.textContent = 'Scene not found. It may have been deleted.';
      state.selectedItem = null;
      return;
    }
    var fm = scene.frontmatter || {};
    function sv(val) { return (val === undefined || val === null) ? '' : String(val); }
    function arrJoin(val) { if (Array.isArray(val)) return val.join(', '); return sv(val); }

    var form = document.createElement('div');
    form.className = 'inspector-form';

    var standardKeys = ['title','status','act','chapter','pov','location','date','time','plotlines'];
    var fields = [
      { key: 'title', label: 'Title', type: 'text', value: sv(scene.title) },
      { key: 'status', label: 'Status', type: 'select', value: sv(fm.status || 'Idea'), options: ['Idea', 'Outline', 'Draft', 'Revised', 'Done'] },
      { key: 'act', label: 'Act', type: 'number', value: sv(fm.act) },
      { key: 'chapter', label: 'Chapter', type: 'number', value: sv(fm.chapter) },
      { key: 'pov', label: 'POV', type: 'text', value: sv(fm.pov) },
      { key: 'location', label: 'Location', type: 'text', value: sv(fm.location) },
      { key: 'date', label: 'Date', type: 'date', value: sv(fm.date) },
      { key: 'time', label: 'Time', type: 'time', value: sv(fm.time) },
      { key: 'plotlines', label: 'Plotlines', type: 'text', value: arrJoin(fm.plotlines) }
    ];

    fields.forEach(function(f) {
      var row = document.createElement('label');
      row.className = 'field-row';
      var input;
      if (f.type === 'select') {
        input = document.createElement('select');
        f.options.forEach(function(opt) {
          var o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          if (f.value === opt) o.selected = true;
          input.appendChild(o);
        });
      } else {
        input = document.createElement('input');
        input.type = f.type;
        input.value = f.value;
      }
      input.className = 'inspector-input';
      input.dataset.key = f.key;
      var lbl = document.createElement('span');
      lbl.textContent = f.label;
      row.appendChild(lbl);
      row.appendChild(input);
      form.appendChild(row);
    });

    var customCfg = (state.data.config && state.data.config.customFields && state.data.config.customFields.scene) || [];
    var extraKeys = Object.keys(fm).filter(function(k) {
      return standardKeys.indexOf(k) === -1 && customCfg.indexOf(k) === -1 && k.indexOf('storyline') !== 0;
    });
    var allCustom = customCfg.concat(extraKeys);
    if (allCustom.length > 0) {
      var customSection = document.createElement('div');
      customSection.className = 'custom-fields';
      customSection.innerHTML = '<div style="font-size:12px;color:#888;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Custom Fields</div>';
      allCustom.forEach(function(key) {
        var row = document.createElement('label');
        row.className = 'field-row';
        var input = document.createElement('input');
        input.type = 'text';
        input.value = sv(fm[key]);
        input.className = 'inspector-input';
        input.dataset.key = key;
        var lbl = document.createElement('span');
        lbl.textContent = key;
        row.appendChild(lbl);
        row.appendChild(input);
        customSection.appendChild(row);
      });
      form.appendChild(customSection);
    }

    appendAddFieldUI(form, 'scene');

    var meta = document.createElement('div');
    meta.className = 'inspector-meta';
    meta.innerHTML = '<span>Words: ' + (scene.wordCount || 0) + '</span>';
    form.appendChild(meta);

    var actions = document.createElement('div');
    actions.className = 'inspector-actions';
    var saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async function() {
      try {
        var updates = {};
        form.querySelectorAll('.inspector-input').forEach(function(input) {
          var key = input.dataset.key;
          if (key === 'title') scene.title = input.value;
          else if (key === 'plotlines') updates[key] = input.value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
          else if (key === 'act' || key === 'chapter') updates[key] = input.value ? parseInt(input.value) : '';
          else updates[key] = input.value;
        });
        if (!scene.frontmatter) scene.frontmatter = {};
        Object.assign(scene.frontmatter, updates);
        await webviewApi.postMessage({ name: 'updateScene', id: scene.id, frontmatter: scene.frontmatter, title: scene.title });
        loadData();
      } catch (e) {
        showError('Save failed: ' + (e && e.message ? e.message : String(e)));
      }
    });

    var openBtn = document.createElement('button');
    openBtn.textContent = 'Open Note';
    openBtn.addEventListener('click', function() { webviewApi.postMessage({ name: 'openNote', id: scene.id }); });
    actions.appendChild(saveBtn);
    actions.appendChild(openBtn);
    form.appendChild(actions);
    container.appendChild(form);
  }

  function renderEntityInspector(container, type) {
    var items = [];
    if (type === 'character') items = state.data.characters || [];
    else if (type === 'location') items = state.data.locations || [];
    else items = (state.data.customCodex && state.data.customCodex[type]) || [];

    var entity = items.find(function(e) { return e.id === state.selectedItem.id; });
    if (!entity) {
      container.textContent = 'Entry not found. It may have been deleted.';
      state.selectedItem = null;
      return;
    }

    var fm = entity.frontmatter || {};
    function sv(val) { return (val === undefined || val === null) ? '' : String(val); }

    var form = document.createElement('div');
    form.className = 'inspector-form';

    var standardKeys = ['title','storyline_codex','storyline_character','storyline_location','aliases'];

    var typeColor = getEntityColor(type);
    var typeLabel = '';
    var types = (state.data.config && state.data.config.codexTypes) || [];
    var typeObj = types.find(function(t) { return t.key === type; });
    if (typeObj) typeLabel = typeObj.label;
    var headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'padding:4px 8px;background:' + typeColor + ';color:#fff;border-radius:4px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;';
    headerDiv.textContent = typeLabel || type;
    form.appendChild(headerDiv);

    var fields = [
      { key: 'title', label: 'Name', type: 'text', value: sv(entity.title) },
      { key: 'aliases', label: 'Aliases (comma-separated)', type: 'text', value: sv(fm.aliases) }
    ];

    fields.forEach(function(f) {
      var row = document.createElement('label');
      row.className = 'field-row';
      var input = document.createElement('input');
      input.type = f.type;
      input.value = f.value;
      input.className = 'inspector-input';
      input.dataset.key = f.key;
      var lbl = document.createElement('span');
      lbl.textContent = f.label;
      row.appendChild(lbl);
      row.appendChild(input);
      form.appendChild(row);
    });

    var aliasHelp = document.createElement('div');
    aliasHelp.style.cssText = 'font-size:10px;color:#666;margin-top:-6px;padding:0 2px;';
    aliasHelp.textContent = 'e.g. "Anna, Heath, AH" \u2014 used for plotgrid matching';
    form.appendChild(aliasHelp);

    var customCfg = (state.data.config && state.data.config.customFields && state.data.config.customFields[type]) || [];
    var extraKeys = Object.keys(fm).filter(function(k) {
      return standardKeys.indexOf(k) === -1 && customCfg.indexOf(k) === -1 && k.indexOf('storyline') !== 0;
    });
    var allCustom = customCfg.concat(extraKeys);
    if (allCustom.length > 0) {
      var customSection = document.createElement('div');
      customSection.className = 'custom-fields';
      customSection.innerHTML = '<div style="font-size:12px;color:#888;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Custom Fields</div>';
      allCustom.forEach(function(key) {
        var row = document.createElement('label');
        row.className = 'field-row';
        var input = document.createElement('input');
        input.type = 'text';
        input.value = sv(fm[key]);
        input.className = 'inspector-input';
        input.dataset.key = key;
        var lbl = document.createElement('span');
        lbl.textContent = key;
        row.appendChild(lbl);
        row.appendChild(input);
        customSection.appendChild(row);
      });
      form.appendChild(customSection);
    }

    appendAddFieldUI(form, type);

    var actions = document.createElement('div');
    actions.className = 'inspector-actions';
    var saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async function() {
      try {
        var updates = {};
        var newTitle = entity.title;
        form.querySelectorAll('.inspector-input').forEach(function(input) {
          var key = input.dataset.key;
          if (key === 'title') newTitle = input.value;
          else updates[key] = input.value;
        });
        if (!entity.frontmatter) entity.frontmatter = {};
        Object.assign(entity.frontmatter, updates);
        await webviewApi.postMessage({ name: 'updateEntity', id: entity.id, frontmatter: entity.frontmatter, title: newTitle, folderId: state.projectFolderId });
        loadData();
      } catch (e) {
        showError('Save failed: ' + (e && e.message ? e.message : String(e)));
      }
    });

    var openBtn = document.createElement('button');
    openBtn.textContent = 'Open Note';
    openBtn.addEventListener('click', function() { webviewApi.postMessage({ name: 'openNote', id: entity.id }); });
    actions.appendChild(saveBtn);
    actions.appendChild(openBtn);
    form.appendChild(actions);
    container.appendChild(form);
  }

  function appendAddFieldUI(form, type) {
    var addFieldWrap = document.createElement('div');
    addFieldWrap.className = 'add-field-row';
    addFieldWrap.style.cssText = 'display:flex;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid #333;';
    var addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.placeholder = 'New field name';
    addInput.style.cssText = 'flex:1;padding:4px 8px;background:#1e1e1e;color:#d4d4d4;border:1px solid #333;border-radius:4px;';
    var addBtn = document.createElement('button');
    addBtn.textContent = '+ Field';
    addBtn.style.cssText = 'padding:4px 10px;background:#2d8bf5;color:white;border:none;border-radius:4px;cursor:pointer;';
    addBtn.addEventListener('click', async function() {
      var key = addInput.value.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      if (!key) return;
      if (!state.data.config.customFields) state.data.config.customFields = {};
      if (!state.data.config.customFields[type]) state.data.config.customFields[type] = [];
      if (state.data.config.customFields[type].indexOf(key) === -1) {
        state.data.config.customFields[type].push(key);
        await webviewApi.postMessage({ name: 'updateConfig', folderId: state.projectFolderId, config: state.data.config });
      }
      addInput.value = '';
      renderInspector();
    });
    addFieldWrap.appendChild(addInput);
    addFieldWrap.appendChild(addBtn);
    form.appendChild(addFieldWrap);
  }

  async function createScene(title) {
    try {
      if (!state.projectFolderId) { showError('No project selected.'); return; }
      var res = await webviewApi.postMessage({ name: 'createScene', title: title, folderId: state.projectFolderId });
      if (res && res.id) {
        state.selectedItem = { id: res.id, type: 'scene' };
        loadData();
      } else if (res && res.error) {
        showError('Backend error: ' + res.error);
      } else {
        showError('Scene creation returned no ID');
      }
    } catch (e) {
      showError('Create scene failed: ' + (e && e.message ? e.message : String(e)));
    }
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.addEventListener('error', function(e) {
    showError('Unhandled error: ' + (e.message || String(e)));
  });

  window.addEventListener('unhandledrejection', function(e) {
    showError('Unhandled rejection: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)));
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
