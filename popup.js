const DRAFT_KEY = 'popupTextEditorDraft';
const SAVED_KEY = 'popupTextEditorSavedText';
const LEGACY_DRAFT_KEY = 'popupTextEditorAutoSavedText';
const AUTO_SAVE_DELAY_MS = 700;
const MAX_UNDO_HISTORY = 50;

const textArea = document.getElementById('textArea');
const characterCount = document.getElementById('characterCount');
const messageElement = document.getElementById('message');
const searchText = document.getElementById('searchText');
const replaceText = document.getElementById('replaceText');
const searchStatus = document.getElementById('searchStatus');
const undoButton = document.getElementById('undoButton');
let autoSaveTimer;
let messageTimer;
const undoHistory = [];

function storageGet(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(key, (result) => {
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

function showMessage(message, kind = 'success') {
  window.clearTimeout(messageTimer);
  messageElement.textContent = message;
  messageElement.dataset.kind = kind;
  messageTimer = window.setTimeout(() => {
    messageElement.textContent = '';
    delete messageElement.dataset.kind;
  }, 2500);
}

function updateCharacterCount() {
  characterCount.textContent = `${textArea.value.length} 文字`;
}

function countMatches(text, query) {
  if (query === '') return 0;
  let count = 0;
  let position = 0;
  while ((position = text.indexOf(query, position)) !== -1) {
    count += 1;
    position += query.length;
  }
  return count;
}

function updateSearchStatus() {
  const query = searchText.value;
  const count = countMatches(textArea.value, query);
  searchStatus.textContent = query === '' ? '' : `${count} 件見つかりました`;
}

function updateUndoButton() {
  undoButton.disabled = undoHistory.length === 0;
}

function applyTextChange(text, message) {
  if (text !== textArea.value) {
    undoHistory.push(textArea.value);
    if (undoHistory.length > MAX_UNDO_HISTORY) undoHistory.shift();
    updateUndoButton();
  }
  textArea.value = text;
  updateCharacterCount();
  updateSearchStatus();
  scheduleAutoSave();
  showMessage(message);
  textArea.focus();
}

async function saveDraft({ notify = false } = {}) {
  try {
    await storageSet({ [DRAFT_KEY]: textArea.value });
    if (notify) showMessage('下書きを自動保存しました');
  } catch (error) {
    showMessage(`自動保存に失敗しました: ${error.message}`, 'error');
  }
}

function scheduleAutoSave() {
  window.clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(() => saveDraft(), AUTO_SAVE_DELAY_MS);
}

async function copyText() {
  try {
    await navigator.clipboard.writeText(textArea.value);
    showMessage('クリップボードにコピーしました');
  } catch (error) {
    showMessage(`コピーに失敗しました: ${error.message}`, 'error');
  }
}

async function appendClipboardText() {
  try {
    const clipboardText = await navigator.clipboard.readText();
    if (clipboardText === '') {
      showMessage('クリップボードにテキストがありません', 'error');
      return;
    }
    const separator = textArea.value === '' ? '' : '\n';
    applyTextChange(`${textArea.value}${separator}${clipboardText}`, 'クリップボードのテキストを追記しました');
  } catch (error) {
    showMessage(`追記に失敗しました: ${error.message}`, 'error');
  }
}

textArea.addEventListener('input', () => {
  updateCharacterCount();
  updateSearchStatus();
  scheduleAutoSave();
});

searchText.addEventListener('input', updateSearchStatus);

document.getElementById('copyButton').addEventListener('click', copyText);
undoButton.addEventListener('click', () => {
  const previousText = undoHistory.pop();
  if (previousText === undefined) return;
  textArea.value = previousText;
  updateUndoButton();
  updateCharacterCount();
  updateSearchStatus();
  scheduleAutoSave();
  showMessage('操作を元に戻しました');
  textArea.focus();
});
document.getElementById('appendButton').addEventListener('click', appendClipboardText);

document.getElementById('saveButton').addEventListener('click', async () => {
  window.clearTimeout(autoSaveTimer);
  try {
    await storageSet({ [SAVED_KEY]: textArea.value, [DRAFT_KEY]: textArea.value });
    showMessage('保存しました');
  } catch (error) {
    showMessage(`保存に失敗しました: ${error.message}`, 'error');
  }
});

document.getElementById('loadButton').addEventListener('click', async () => {
  try {
    const data = await storageGet(SAVED_KEY);
    if (data[SAVED_KEY] === undefined) {
      showMessage('保存済みのメモはありません', 'error');
      return;
    }
    applyTextChange(data[SAVED_KEY], '保存済みのメモを読み込みました');
  } catch (error) {
    showMessage(`読み込みに失敗しました: ${error.message}`, 'error');
  }
});

document.getElementById('clearButton').addEventListener('click', () => {
  if (!window.confirm('入力中のメモを消去しますか？')) return;
  applyTextChange('', 'メモを消去しました');
});

document.getElementById('findNextButton').addEventListener('click', () => {
  const query = searchText.value;
  if (query === '') {
    showMessage('検索する文字列を入力してください', 'error');
    searchText.focus();
    return;
  }

  const start = textArea.selectionEnd;
  let index = textArea.value.indexOf(query, start);
  let wrapped = false;
  if (index === -1 && start > 0) {
    index = textArea.value.indexOf(query);
    wrapped = index !== -1;
  }
  if (index === -1) {
    showMessage('見つかりませんでした', 'error');
    return;
  }

  textArea.focus();
  textArea.setSelectionRange(index, index + query.length);
  showMessage(wrapped ? '先頭に戻って見つけました' : '見つけました');
});

document.getElementById('replaceAllButton').addEventListener('click', () => {
  const query = searchText.value;
  if (query === '') {
    showMessage('検索する文字列を入力してください', 'error');
    searchText.focus();
    return;
  }
  const count = countMatches(textArea.value, query);
  if (count === 0) {
    showMessage('置換する文字列がありません', 'error');
    return;
  }
  applyTextChange(textArea.value.split(query).join(replaceText.value), `${count} 件を置換しました`);
});

document.getElementById('normalizeButton').addEventListener('click', () => {
  const normalized = textArea.value.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0xFEE0));
  if (normalized === textArea.value) {
    showMessage('変換する全角英数字はありません');
    return;
  }
  applyTextChange(normalized, '全角英数字を半角に変換しました');
});

document.getElementById('collapseNumberBreaksButton').addEventListener('click', () => {
  const pattern = /([0-9０-９])[ \t　]*\r?\n/g;
  const count = (textArea.value.match(pattern) || []).length;
  if (count === 0) {
    showMessage('数字の直後にある空白と改行はありません');
    return;
  }
  applyTextChange(textArea.value.replace(pattern, '$1 '), `${count} か所の改行を半角スペースに変換しました`);
});

document.getElementById('removeLineBreaksButton').addEventListener('click', () => {
  const normalizedLineEndings = textArea.value.replace(/\r\n?/g, '\n');
  const withoutTrailingSpaces = normalizedLineEndings.replace(/[ \t　\u00A0]+\n/g, '\n');
  const transformed = withoutTrailingSpaces.replace(/\n+/g, (lineBreaks, offset, text) => {
    if (lineBreaks.length >= 2) return '\n\n';
    const previousCharacter = text[offset - 1];
    return previousCharacter === '」' || previousCharacter === '。' ? '\n' : '';
  });
  if (transformed === textArea.value) {
    showMessage('削除できる改行はありません');
    return;
  }
  applyTextChange(transformed, '改行を削除しました');
});

document.getElementById('mergeSelectedLinesButton').addEventListener('click', () => {
  const { selectionStart: start, selectionEnd: end, value } = textArea;
  if (start === end) {
    showMessage('右側へ移したい行を選択してください', 'error');
    return;
  }
  if ((start > 0 && value[start - 1] !== '\n') || (end < value.length && value[end] !== '\n')) {
    showMessage('行の先頭から末尾までを選択してください', 'error');
    return;
  }

  const sourceLines = value.slice(start, end)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const linesBeforeSelection = value.slice(0, start).split('\n');
  const availableTargetIndexes = linesBeforeSelection
    .map((line, index) => (line.trim() === '' ? -1 : index))
    .filter((index) => index !== -1);

  if (sourceLines.length === 0) {
    showMessage('選択範囲に移動できる行がありません', 'error');
    return;
  }
  if (availableTargetIndexes.length === 0) {
    showMessage('結合先となる上側の行がありません', 'error');
    return;
  }

  const pairCount = Math.min(sourceLines.length, availableTargetIndexes.length);
  const targetIndexes = availableTargetIndexes.slice(-pairCount);

  targetIndexes.forEach((targetIndex, sourceIndex) => {
    const target = linesBeforeSelection[targetIndex].replace(/[ \t　]+$/, '');
    linesBeforeSelection[targetIndex] = `${target} ${sourceLines[sourceIndex]}`;
  });
  const remainingSourceLines = sourceLines.slice(pairCount);
  const remainingText = `${linesBeforeSelection.join('\n')}${remainingSourceLines.join('\n')}${value.slice(end)}`
    .replace(/\n{3,}/g, '\n\n');
  const message = remainingSourceLines.length === 0
    ? `${pairCount} 行を上の行へ結合しました`
    : `${pairCount} 行を結合し、${remainingSourceLines.length} 行は残しました`;
  applyTextChange(remainingText, message);
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    copyText();
  }
});

window.addEventListener('pagehide', () => {
  window.clearTimeout(autoSaveTimer);
  chrome.storage.sync.set({ [DRAFT_KEY]: textArea.value });
});

async function initialize() {
  try {
    const data = await storageGet([DRAFT_KEY, LEGACY_DRAFT_KEY]);
    if (data[DRAFT_KEY] !== undefined) {
      textArea.value = data[DRAFT_KEY];
    } else if (data[LEGACY_DRAFT_KEY] !== undefined) {
      textArea.value = data[LEGACY_DRAFT_KEY];
      await storageSet({ [DRAFT_KEY]: textArea.value });
    }
  } catch (error) {
    showMessage(`下書きを読み込めませんでした: ${error.message}`, 'error');
  }
  updateCharacterCount();
  updateSearchStatus();
  textArea.focus();
}

initialize();
