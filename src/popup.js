(async () => {
 const $ = id => document.getElementById(id);
 let settings = { ...YTM.defaults };
 let saveTimer;
 let writeQueue = Promise.resolve();
 const status = message => { $('status').textContent = message; };
 function persist() {
  const snapshot = { ...settings };
  writeQueue = writeQueue.catch(() => {}).then(() => chrome.storage.sync.set({ settings: snapshot }));
  writeQueue.then(() => status('Saved · applied to all Music tabs')).catch(() => status('Could not save. Please try again.'));
  return writeQueue;
 }
 const themes = $('themes');
 for (const [key, preset] of Object.entries(YTM.presets)) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'theme'; button.dataset.theme = key;
  button.style.setProperty('--swatch-bg', preset.background); button.style.setProperty('--swatch-player', preset.player);
  const swatch = document.createElement('span'); swatch.className = 'swatch';
  button.append(swatch, document.createTextNode(preset.name));
  button.addEventListener('click', () => {
   settings.theme = key;
   if (key !== 'UserDefined') for (const field of ['background', 'player', 'accent']) settings[field] = preset[field];
   render(); clearTimeout(saveTimer); persist();
  });
  themes.append(button);
 }
 function render() {
  for (const key of Object.keys(YTM.defaults)) {
   const input = $(key); if (!input) continue;
   if (input.type === 'checkbox') input.checked = settings[key]; else input.value = settings[key];
  }
  for (const button of themes.children) button.setAttribute('aria-pressed', String(button.dataset.theme === settings.theme));
  const palette = settings.theme === 'UserDefined' ? settings : YTM.presets[settings.theme];
  for (const [variable, field] of [['canvas', 'background'], ['player', 'player'], ['accent', 'accent']]) $('preview').style.setProperty(`--${variable}`, palette[field]);
  for (const [key, unit] of [['volumeWidth', 'px'], ['queueWidth', '%'], ['padding', 'px']]) $(key + 'Value').textContent = settings[key] + unit;
  $('queueWidth').disabled = !settings.customWidth;
 }
 // Disable editing until stored preferences have loaded.
 for (const input of document.querySelectorAll('input, button')) input.disabled = true;
 try { settings = YTM.normalize((await chrome.storage.sync.get('settings')).settings); } catch { status('Could not load saved settings'); }
 for (const input of document.querySelectorAll('input, button')) input.disabled = false;
 render();
 for (const key of Object.keys(YTM.defaults)) {
  const input = $(key); if (!input) continue;
  input.addEventListener('input', () => {
   settings[key] = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
   if (['background', 'player', 'accent'].includes(key)) settings.theme = 'UserDefined';
   settings = YTM.normalize(settings); render(); status('Applying…'); clearTimeout(saveTimer);
   if (input.type === 'checkbox') persist(); else saveTimer = setTimeout(persist, 180);
  });
  input.addEventListener('change', () => { clearTimeout(saveTimer); persist(); });
 }
 $('reset').addEventListener('click', () => { clearTimeout(saveTimer); settings = { ...YTM.defaults }; render(); persist(); });
 $('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ schemaVersion: 1, settings }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'youtube-music-settings.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); status('Settings exported');
 });
 $('import').addEventListener('click', () => $('file').click());
 $('file').addEventListener('change', async event => {
  try {
   const file = event.target.files[0]; if (!file) return;
   if (file.size > 32768) throw new Error('large');
   const data = JSON.parse(await file.text());
   if (data.schemaVersion !== 1 || !data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) throw new Error('format');
   clearTimeout(saveTimer); settings = YTM.normalize(data.settings); render(); await persist(); status('Settings imported');
  } catch { status('Import failed. Choose a valid settings backup.'); }
  event.target.value = '';
 });
})();
