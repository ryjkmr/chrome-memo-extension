const DRAFT_KEY = 'chromeMemoWebDraft';
const SAVED_KEY = 'chromeMemoWebSavedText';
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

function showMessage(message, kind = 'success') {
  window.clearTimeout(messageTimer);
  messageElement.textContent = message;
  messageElement.dataset.kind = kind;
  messageTimer = window.setTimeout(() => {
    messageElement.textContent = '';
    delete messageElement.dataset.kind;
  }, 3000);
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
  const count = countMatches(textArea.value, searchText.value);
  searchStatus.textContent = searchText.value === '' ? '' : `${count} 件見つかりました`;
}

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, textArea.value);
  } catch (error) {
    showMessage(`自動保存に失敗しました: ${error.message}`, 'error');
  }
}

function scheduleAutoSave() {
  window.clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(saveDraft, 500);
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
  saveDraft();
  showMessage(message);
  textArea.focus();
}

textArea.addEventListener('input', () => {
  updateCharacterCount();
  updateSearchStatus();
  scheduleAutoSave();
});
searchText.addEventListener('input', updateSearchStatus);

document.getElementById('copyButton').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(textArea.value);
    showMessage('クリップボードにコピーしました');
  } catch (error) {
    showMessage(`コピーに失敗しました: ${error.message}`, 'error');
  }
});

undoButton.addEventListener('click', () => {
  const previousText = undoHistory.pop();
  if (previousText === undefined) return;
  textArea.value = previousText;
  updateUndoButton();
  updateCharacterCount();
  updateSearchStatus();
  saveDraft();
  showMessage('操作を元に戻しました');
  textArea.focus();
});

document.getElementById('saveButton').addEventListener('click', () => {
  try {
    localStorage.setItem(SAVED_KEY, textArea.value);
    saveDraft();
    showMessage('保存しました');
  } catch (error) {
    showMessage(`保存に失敗しました: ${error.message}`, 'error');
  }
});

document.getElementById('loadButton').addEventListener('click', () => {
  const savedText = localStorage.getItem(SAVED_KEY);
  if (savedText === null) {
    showMessage('保存済みのメモはありません', 'error');
    return;
  }
  applyTextChange(savedText, '保存済みのメモを読み込みました');
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
  const sourceLines = value.slice(start, end).split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const linesBeforeSelection = value.slice(0, start).split('\n');
  const availableTargetIndexes = linesBeforeSelection.map((line, index) => (line.trim() === '' ? -1 : index)).filter((index) => index !== -1);
  if (sourceLines.length === 0) {
    showMessage('選択範囲に移動できる行がありません', 'error');
    return;
  }
  if (availableTargetIndexes.length === 0) {
    showMessage('結合先となる上側の行がありません', 'error');
    return;
  }
  const pairCount = Math.min(sourceLines.length, availableTargetIndexes.length);
  availableTargetIndexes.slice(-pairCount).forEach((targetIndex, sourceIndex) => {
    const target = linesBeforeSelection[targetIndex].replace(/[ \t　]+$/, '');
    linesBeforeSelection[targetIndex] = `${target} ${sourceLines[sourceIndex]}`;
  });
  const remainingSourceLines = sourceLines.slice(pairCount);
  const remainingText = `${linesBeforeSelection.join('\n')}${remainingSourceLines.join('\n')}${value.slice(end)}`.replace(/\n{3,}/g, '\n\n');
  const message = remainingSourceLines.length === 0 ? `${pairCount} 行を上の行へ結合しました` : `${pairCount} 行を結合し、${remainingSourceLines.length} 行は残しました`;
  applyTextChange(remainingText, message);
});

try {
  textArea.value = localStorage.getItem(DRAFT_KEY) || '';
} catch (error) {
  showMessage(`下書きを読み込めませんでした: ${error.message}`, 'error');
}
updateCharacterCount();
updateSearchStatus();
textArea.focus();
