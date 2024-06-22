document.getElementById('copyButton').addEventListener('click', () => {
  const text = document.getElementById('textArea').value;
  navigator.clipboard.writeText(text).then(() => {
    showMessageForOneSecond('Copied to Clipboard');
  });
});

function showMessageForOneSecond(message) {
  const messageElement = document.getElementById('message');
  messageElement.textContent = message;

  setTimeout(() => {
    messageElement.textContent = '';
  }, 1000); // 1000ミリ秒後に実行
}

document.getElementById('saveButton').addEventListener('click', () => {
  const text = document.getElementById('textArea').value;
  chrome.storage.sync.set({ 'popupTextEditorSavedText': text }, () => {
    showMessageForOneSecond('Save to Cloud');
  });
});

document.getElementById('loadButton').addEventListener('click', () => {
  chrome.storage.sync.get('popupTextEditorSavedText', (data) => {
    document.getElementById('textArea').value = data.popupTextEditorSavedText;
    showMessageForOneSecond('Loaded from Cloud');
  });
});


document.getElementById('textArea').addEventListener('input', function() {
  const text = this.value;
  chrome.storage.sync.set({'popupTextEditorAutoSavedText': text}, function() {
    console.log('auto saved');
  });
});



document.addEventListener('DOMContentLoaded', () => {
  console.log("load");
  chrome.storage.sync.get(['popupTextEditorAutoSavedText'], function (result) {
    if (result.popupTextEditorAutoSavedText !== undefined) {
      document.getElementById('textArea').value = result.popupTextEditorAutoSavedText;
    }
  });
  document.getElementById('textArea').focus();
});

