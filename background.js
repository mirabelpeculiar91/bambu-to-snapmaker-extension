// Service worker — handles file downloads on behalf of the content script.
// chrome.downloads is not available in content scripts; the background SW
// triggers the download so Chrome's download manager handles it correctly.

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'u1_download') return;
  chrome.downloads.download({
    url:      msg.url,
    filename: msg.filename,
  });
});
