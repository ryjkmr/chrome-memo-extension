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

function getAppendShortcut() {
  return new Promise((resolve) => {
    chrome.commands.getAll((commands) => {
      if (chrome.runtime.lastError) {
        console.error('ショートカットを取得できませんでした:', chrome.runtime.lastError.message);
        resolve('');
        return;
      }
      resolve(commands.find((command) => command.name === 'append-selection')?.shortcut || '');
    });
  });
}

function contextMenuTitle(shortcut) {
  return shortcut
    ? `Chrome メモに追記（${shortcut}）`
    : 'Chrome メモに追記（ショートカット未設定）';
}

async function createContextMenu() {
  await new Promise((resolve) => chrome.contextMenus.removeAll(resolve));
  chrome.contextMenus.create({
    id: MENU_ID,
    title: contextMenuTitle(await getAppendShortcut()),
    contexts: ['selection'],
  });
}

async function updateContextMenuTitle() {
  try {
    await chrome.contextMenus.update(MENU_ID, {
      title: contextMenuTitle(await getAppendShortcut()),
    });
  } catch (error) {
    console.error('右クリックメニューを更新できませんでした:', error);
  }
}

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

chrome.contextMenus.onClicked.addListener(async (info) => {
  try {
    await appendToMemo(info.selectionText);
  } catch (error) {
    console.error('選択テキストを追記できませんでした:', error);
  } finally {
    await updateContextMenuTitle();
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
  } finally {
    await updateContextMenuTitle();
  }
});
