(() => {
 const style = document.createElement('style');
 style.id = 'ytm-custom-themes';
 let current = YTM.defaults;
 function apply() {
  style.textContent = YTM.buildCss(current);
  if (document.documentElement && !style.isConnected) document.documentElement.append(style);
 }
 // Register before the asynchronous read so changes cannot be lost during startup.
 let revision = 0;
 chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.settings) {
   revision++;
   current = YTM.normalize(changes.settings.newValue);
   apply();
  }
 });
 const initialRevision = revision;
 chrome.storage.sync.get('settings').then(({ settings }) => {
  if (revision === initialRevision) current = YTM.normalize(settings);
  apply();
 }).catch(() => apply());
 if (!document.documentElement) {
  const observer = new MutationObserver(() => {
   if (document.documentElement) { apply(); observer.disconnect(); }
  });
  observer.observe(document, { childList: true });
 }
})();
