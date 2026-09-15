chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'get-selection') return;
  sendResponse({ text: window.getSelection().toString() });
});
