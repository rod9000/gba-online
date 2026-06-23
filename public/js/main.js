/* GBA Online – Frontend */
(() => {
  'use strict';

  // ── Palette for game covers (seeded by game name) ──
  const PALETTES = [
    ['#7c3aed','#a855f7'], ['#1d4ed8','#60a5fa'],
    ['#0f766e','#34d399'], ['#b91c1c','#f87171'],
    ['#b45309','#fbbf24'], ['#15803d','#4ade80'],
    ['#0e7490','#22d3ee'], ['#7e22ce','#e879f9'],
  ];

  function hashName(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff;
    return h;
  }

  function getGamePalette(name) {
    return PALETTES[hashName(name) % PALETTES.length];
  }

  // ── Toast ──
  let toastTimer;
  function showToast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 3500);
  }

  // ── Games Grid ──
  async function loadLibrary() {
    const grid = document.getElementById('games-grid');
    grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Carregando jogos...</p></div>';
    try {
      const res = await fetch('/api/games');
      const { games } = await res.json();
      renderGrid(games);
    } catch {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠</div><p>Erro ao carregar biblioteca</p></div>';
    }
  }

  function renderGrid(games) {
    const grid = document.getElementById('games-grid');
    if (!games.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎮</div>
          <div class="empty-title">Nenhum jogo na biblioteca</div>
          <p>Adicione arquivos <strong>.gba</strong> à pasta <code>roms/</code> do servidor<br/>ou faça upload abaixo.</p>
          <div class="empty-instructions">
            <strong>Como adicionar jogos ao servidor:</strong><br/>
            1. Coloque arquivos <code>.gba</code> na pasta <code>roms/</code><br/>
            2. Clique em <strong>Atualizar</strong> para recarregar
          </div>
        </div>`;
      return;
    }

    grid.innerHTML = '';
    games.forEach(game => grid.appendChild(createGameCard(game)));
  }

  function createGameCard(game) {
    const [c1, c2] = getGamePalette(game.name);
    const card = document.createElement('div');
    card.className = 'game-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Jogar ${game.name}`);
    card.innerHTML = `
      <div class="game-card-cover" style="background: linear-gradient(135deg, ${c1}, ${c2});">
        <span style="font-size:2.8rem;z-index:0;opacity:.25;user-select:none;">◉</span>
        <div class="play-overlay">
          <div class="play-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
      </div>
      <div class="game-card-info">
        <div class="game-card-name">${escHtml(game.name)}</div>
        <span class="game-card-badge ${game.source === 'upload' ? 'badge-upload' : 'badge-library'}">
          ${game.source === 'upload' ? 'Upload' : 'Biblioteca'}
        </span>
      </div>`;
    card.addEventListener('click', () => launchGame(game.url, game.name));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') launchGame(game.url, game.name); });
    return card;
  }

  function escHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ── Emulator ──
  function launchGame(romUrl, gameName) {
    const section = document.getElementById('emulator-section');
    const frame   = document.getElementById('emulator-frame');
    const nameEl  = document.getElementById('current-game-name');

    const params = new URLSearchParams({ rom: romUrl, name: gameName });
    frame.src = `/emulator.html?${params}`;
    nameEl.textContent = gameName;
    section.removeAttribute('hidden');
    document.querySelector('.gba-wrapper')?.classList.add('game-active');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`Carregando: ${gameName}`, 'info');
  }

  document.getElementById('btn-close-emulator')?.addEventListener('click', () => {
    const section = document.getElementById('emulator-section');
    const frame   = document.getElementById('emulator-frame');
    frame.src = '';
    section.setAttribute('hidden', '');
    document.querySelector('.gba-wrapper')?.classList.remove('game-active');
  });

  document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
    const target = document.querySelector('.gba-wrapper') || document.getElementById('emulator-frame');
    if (target.requestFullscreen) target.requestFullscreen();
    else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
  });

  document.getElementById('btn-refresh')?.addEventListener('click', loadLibrary);

  // ── Settings Modal ──
  const settingsOverlay = document.getElementById('settings-overlay');

  function openSettings() { settingsOverlay?.removeAttribute('hidden'); }
  function closeSettings() { settingsOverlay?.setAttribute('hidden', ''); }

  document.getElementById('btn-settings')?.addEventListener('click', openSettings);
  document.getElementById('btn-settings-close')?.addEventListener('click', closeSettings);
  settingsOverlay?.addEventListener('click', e => { if (e.target === settingsOverlay) closeSettings(); });

  function sendEmulatorAction(action) {
    const frame = document.getElementById('emulator-frame');
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage({ _gba: true, action }, '*');
  }

  document.getElementById('btn-save-state')?.addEventListener('click', () => {
    sendEmulatorAction('saveState');
    showToast('Estado salvo', 'success');
    closeSettings();
  });
  document.getElementById('btn-load-state')?.addEventListener('click', () => {
    sendEmulatorAction('loadState');
    showToast('Estado carregado', 'info');
    closeSettings();
  });

  // ── Upload ──
  async function handleFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.gba')) {
      showToast('Apenas arquivos .gba são suportados', 'error');
      return;
    }
    if (file.size > 64 * 1024 * 1024) {
      showToast('Arquivo muito grande (máximo 64 MB)', 'error');
      return;
    }

    const progressSection = document.getElementById('upload-progress');
    const progressFill    = document.getElementById('progress-fill');
    const progressLabel   = document.getElementById('progress-label');

    progressSection.removeAttribute('hidden');
    progressFill.style.width = '0%';
    progressLabel.textContent = 'Enviando...';

    const formData = new FormData();
    formData.append('rom', file);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          progressFill.style.width = pct + '%';
          progressLabel.textContent = `Enviando... ${pct}%`;
        }
      });

      const result = await new Promise((resolve, reject) => {
        xhr.onload  = () => resolve(JSON.parse(xhr.responseText));
        xhr.onerror = () => reject(new Error('Falha na conexão'));
        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });

      if (result.error) throw new Error(result.error);

      progressFill.style.width = '100%';
      progressLabel.textContent = 'Concluído!';
      showToast(`ROM carregada: ${result.name}`, 'success');

      // Launch immediately
      setTimeout(() => {
        progressSection.setAttribute('hidden', '');
        launchGame(result.url, result.name);
      }, 800);

    } catch (err) {
      progressSection.setAttribute('hidden', '');
      showToast(`Erro: ${err.message}`, 'error');
    }
  }

  function setupFileInput(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('change', () => {
      if (input.files[0]) handleFile(input.files[0]);
      input.value = '';
    });
  }
  setupFileInput('rom-input');
  setupFileInput('rom-input-2');

  // ── Drag & Drop ──
  const uploadZone = document.getElementById('upload-zone');
  if (uploadZone) {
    ['dragenter','dragover'].forEach(ev => {
      uploadZone.addEventListener(ev, e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
    });
    ['dragleave','drop'].forEach(ev => {
      uploadZone.addEventListener(ev, e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); });
    });
    uploadZone.addEventListener('drop', e => {
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
    uploadZone.addEventListener('click', e => {
      if (e.target.closest('.upload-trigger')) return;
      document.getElementById('rom-input-2')?.click();
    });
  }

  // ── Global drag-over visual ──
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.gba')) handleFile(file);
  });

  // ── GBA Physical Buttons → emulator (via postMessage) ──
  function sendKey(keyCode, keyName, eventType) {
    const frame = document.getElementById('emulator-frame');
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage(
      { _gba: true, type: eventType, keyCode, key: keyName },
      '*'
    );
  }

  function bindGBAButton(el) {
    if (!el || !el.dataset.key) return;
    const keyCode = parseInt(el.dataset.key, 10);
    const keyName = el.dataset.keyname || String.fromCharCode(keyCode);

    const press = e => {
      e.preventDefault();
      el.classList.add('pressed');
      sendKey(keyCode, keyName, 'keydown');
    };
    const release = e => {
      e.preventDefault();
      el.classList.remove('pressed');
      sendKey(keyCode, keyName, 'keyup');
    };

    el.addEventListener('mousedown',  press);
    el.addEventListener('mouseup',    release);
    el.addEventListener('mouseleave', release);
    el.addEventListener('touchstart', press,   { passive: false });
    el.addEventListener('touchend',   release, { passive: false });
    el.addEventListener('touchcancel',release, { passive: false });
  }

  function setupGBAButtons() {
    document.querySelectorAll('[data-key]').forEach(bindGBAButton);
  }

  // Re-bind when emulator section becomes visible (buttons may not exist yet)
  const emulatorSection = document.getElementById('emulator-section');
  if (emulatorSection) {
    new MutationObserver(() => setupGBAButtons())
      .observe(emulatorSection, { attributes: true, attributeFilter: ['hidden'] });
  }

  // ── Init ──
  loadLibrary();
  setupGBAButtons();
})();
