const DRAFT_KEY = 'popupTextEditorDraft';
const LEGACY_DRAFT_KEY = 'popupTextEditorAutoSavedText';
const MENU_ID = 'append-selection-to-memo';

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(keys, (result) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(result);
    });
  });
}

function storageSet(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(value, () => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve();
    });
  });
}

async function appendToMemo(text) {
  if (!text) return;
  const data = await storageGet([DRAFT_KEY, LEGACY_DRAFT_KEY]);
  const currentText = data[DRAFT_KEY] ?? data[LEGACY_DRAFT_KEY] ?? '';
  const separator = currentText === '' ? '' : '\n';
  await storageSet({ [DRAFT_KEY]: `${currentText}${separator}${text}` });
}

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Chrome メモに追記',
      contexts: ['selection'],
    });
  });
}

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

chrome.contextMenus.onClicked.addListener(async (info) => {
  try {
    await appendToMemo(info.selectionText);
  } catch (error) {
    console.error('選択テキストを追記できませんでした:', error);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'append-selection') return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'get-selection' });
    await appendToMemo(response?.text);
  } catch (error) {
    console.error('選択テキストを追記できませんでした:', error);
  }
});
