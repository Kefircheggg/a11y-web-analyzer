// Элементы DOM
const analyzeBtn = document.getElementById('analyzeBtn');
const navigationControls = document.getElementById('navigationControls');
const prevIssueBtn = document.getElementById('prevIssueBtn');
const nextIssueBtn = document.getElementById('nextIssueBtn');
const newReportBtn = document.getElementById('newReportBtn');
const viewResultsBtn = document.getElementById('viewResultsBtn');
const clearStorageBtn = document.getElementById('clearStorageBtn');
const currentIssueNum = document.getElementById('currentIssueNum');
const totalIssuesNum = document.getElementById('totalIssuesNum');
const statusDiv = document.getElementById('status');
const statusText = document.getElementById('statusText');
const errorDiv = document.getElementById('error');
const errorText = document.getElementById('errorText');

let currentIssueIndex = 0;
let totalIssues = 0;
let currentTabId = null;
let currentAnalysisData = null;

const MAX_STORED_REPORTS = 1;

// Функция для безопасного сохранения с обработкой квоты
async function safeStorageSet(data) {
  try {
    await chrome.storage.local.set(data);
  } catch (storageError) {
    console.error('Storage error:', storageError);
    
    // Если превышена квота, очищаем всё и сохраняем только текущие данные
    if (storageError.message && (storageError.message.includes('QUOTA') || storageError.message.includes('quota'))) {
      console.warn('Storage quota exceeded, clearing all data and retrying...');
      await chrome.storage.local.clear();
      await chrome.storage.local.set(data);
    } else {
      throw storageError;
    }
  }
}

async function limitStoredReports(allAnalyses, currentUrl) {
  const urls = Object.keys(allAnalyses);
  
  if (urls.length >= MAX_STORED_REPORTS) {
    console.log(`Cleaning up old reports. Current: ${urls.length}, Max: ${MAX_STORED_REPORTS}`);
    
    const urlsWithTime = urls.map(url => ({
      url: url,
      timestamp: allAnalyses[url].timestamp || 0
    }));
    
    urlsWithTime.sort((a, b) => a.timestamp - b.timestamp);
    
    const toRemove = urlsWithTime.filter(item => item.url !== currentUrl);
    
    for (const item of toRemove) {
      delete allAnalyses[item.url];
      
      const analysisKey = `analysis_${item.url}`;
      const issueIndexKey = `issueIndex_${item.url}`;
      try {
        await chrome.storage.local.remove([analysisKey, issueIndexKey]);
        console.log('Removed old analysis for:', item.url);
      } catch (error) {
        console.error('Error removing old analysis:', error);
      }
    }
  }
  
  return allAnalyses;
}

chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  const currentTab = tabs[0];
  
  if (!currentTab) {
    console.log('No active tab found');
    return;
  }
  
  const currentUrl = currentTab.url;
  console.log('Current tab URL:', currentUrl);
  
  const issueIndexKey = `issueIndex_${currentUrl}`;
  
  chrome.storage.local.get(['allAnalyses', issueIndexKey], async (result) => {
    console.log('Popup opened, checking for saved analysis...');
    
    let allAnalyses = result.allAnalyses || {};
    
    // Очищаем старые отчеты при загрузке (если их больше лимита)
    if (Object.keys(allAnalyses).length > MAX_STORED_REPORTS) {
      console.log('Cleaning up old reports...');
      allAnalyses = await limitStoredReports(allAnalyses, currentUrl);
      await safeStorageSet({ allAnalyses: allAnalyses });
    }
    
    const urlAnalysis = allAnalyses[currentUrl];
    
    if (urlAnalysis) {
      currentAnalysisData = urlAnalysis;
      currentTabId = currentTab.id;
      
      console.log('Found saved analysis for current URL');
      
      totalIssues = 0;
      currentAnalysisData.axeResults.violations.forEach(violation => {
        violation.nodes.forEach(node => {
          totalIssues += node.target.length;
        });
      });
      
      console.log('Total issues:', totalIssues);
      
      if (totalIssues > 0) {
        if (result[issueIndexKey] !== undefined) {
          currentIssueIndex = result[issueIndexKey];
          console.log('Restored issue index for this URL:', currentIssueIndex);
        } else {
          currentIssueIndex = 1;
        }
        
        navigationControls.classList.remove('hidden');
        analyzeBtn.classList.add('hidden');
        
        totalIssuesNum.textContent = totalIssues;
        currentIssueNum.textContent = currentIssueIndex;
        
        updateNavigationButtons();
        
        await safeStorageSet({ 
          latestAnalysis: urlAnalysis,
          analysisUrl: currentUrl
        });
      }
    } else {
      console.log('No saved analysis for this URL');
      
      navigationControls.classList.add('hidden');
      analyzeBtn.classList.remove('hidden');
      analyzeBtn.disabled = false;
      
      currentAnalysisData = null;
      currentIssueIndex = 0;
      totalIssues = 0;
    }
  });
});

analyzeBtn.addEventListener('click', async () => {
  try {
    errorDiv.classList.add('hidden');
    
    analyzeBtn.disabled = true;
    statusDiv.classList.remove('hidden');
    statusText.textContent = 'Analyzing page...';
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    currentTabId = tab.id;
    const currentUrl = tab.url;
    
    console.log('Starting analysis for URL:', currentUrl);
    
    chrome.runtime.sendMessage({
      action: 'startAnalysis',
      tabId: tab.id
    }, async (response) => {
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        showError(chrome.runtime.lastError.message);
        return;
      }
      
      console.log('Response from background:', response);
      
      if (response && response.success) {
        statusText.textContent = 'Analysis complete!';
        
        const result = await chrome.storage.local.get(['latestAnalysis', 'allAnalyses']);
        if (result.latestAnalysis) {
          currentAnalysisData = result.latestAnalysis;
          
          // Добавляем timestamp к данным анализа
          currentAnalysisData.timestamp = Date.now();
          
          let allAnalyses = result.allAnalyses || {};
          allAnalyses[currentUrl] = currentAnalysisData;
          
          // Ограничиваем количество сохраненных отчетов
          allAnalyses = await limitStoredReports(allAnalyses, currentUrl);
          
          await safeStorageSet({
            allAnalyses: allAnalyses,
            latestAnalysis: currentAnalysisData,
            analysisUrl: currentUrl
          });
          
          totalIssues = 0;
          currentAnalysisData.axeResults.violations.forEach(violation => {
            violation.nodes.forEach(node => {
              totalIssues += node.target.length;
            });
          });
          
          console.log('Total issues found:', totalIssues);
          
          navigationControls.classList.remove('hidden');
          analyzeBtn.classList.add('hidden');
          statusDiv.classList.add('hidden');
          
          totalIssuesNum.textContent = totalIssues;
          currentIssueIndex = 0;
          
          if (totalIssues > 0) {
            currentIssueIndex = 1;
            currentIssueNum.textContent = currentIssueIndex;
            showCurrentIssue();
          }
          
          updateNavigationButtons();
        }
      } else {
        const errorMsg = response?.error || 'Analysis failed';
        console.error('Analysis error:', errorMsg);
        showError(errorMsg);
      }
    });
    
  } catch (error) {
    showError(error.message);
  }
});

function showError(message) {
  analyzeBtn.disabled = false;
  statusDiv.classList.add('hidden');
  errorDiv.classList.remove('hidden');
  errorText.textContent = message;
}

// Слушаем сообщения от background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'analysisProgress') {
    statusText.textContent = message.text;
  } else if (message.action === 'analysisError') {
    showError(message.error);
  }
});

// Обработчик кнопки "Previous"
prevIssueBtn.addEventListener('click', async () => {
  if (currentIssueIndex > 1) {
    currentIssueIndex--;
    currentIssueNum.textContent = currentIssueIndex;
    updateNavigationButtons();
    await showCurrentIssue();
  }
});

// Обработчик кнопки "Next"
nextIssueBtn.addEventListener('click', async () => {
  if (currentIssueIndex < totalIssues) {
    currentIssueIndex++;
    currentIssueNum.textContent = currentIssueIndex;
    updateNavigationButtons();
    await showCurrentIssue();
  }
});

// Обработчик кнопки "Сделать новый отчет"
newReportBtn.addEventListener('click', async () => {
  try {
    errorDiv.classList.add('hidden');
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    currentTabId = tab.id;
    const currentUrl = tab.url;
    
    // Очищаем все подсветки на странице перед новым анализом
    try {
      await chrome.tabs.sendMessage(currentTabId, {
        action: 'clearHighlights'
      });
      console.log('Cleared all highlights before new analysis');
    } catch (error) {
      console.log('No highlights to clear or content script not loaded');
    }
    
    // Скрываем навигацию и показываем статус
    navigationControls.classList.add('hidden');
    statusDiv.classList.remove('hidden');
    statusText.textContent = 'Analyzing page...';
    
    console.log('Starting new analysis for URL:', currentUrl);
    
    chrome.runtime.sendMessage({
      action: 'startAnalysis',
      tabId: tab.id
    }, async (response) => {
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        showError(chrome.runtime.lastError.message);
        navigationControls.classList.remove('hidden');
        return;
      }
      
      console.log('Response from background:', response);
      
      if (response && response.success) {
        statusText.textContent = 'Analysis complete!';
        
        const result = await chrome.storage.local.get(['latestAnalysis', 'allAnalyses']);
        if (result.latestAnalysis) {
          currentAnalysisData = result.latestAnalysis;
          
          // Добавляем timestamp к данным анализа
          currentAnalysisData.timestamp = Date.now();
          
          let allAnalyses = result.allAnalyses || {};
          allAnalyses[currentUrl] = currentAnalysisData;
          
          // Ограничиваем количество сохраненных отчетов
          allAnalyses = await limitStoredReports(allAnalyses, currentUrl);
          
          await safeStorageSet({
            allAnalyses: allAnalyses,
            latestAnalysis: currentAnalysisData,
            analysisUrl: currentUrl
          });
          
          totalIssues = 0;
          currentAnalysisData.axeResults.violations.forEach(violation => {
            violation.nodes.forEach(node => {
              totalIssues += node.target.length;
            });
          });
          
          console.log('Total issues found:', totalIssues);
          
          navigationControls.classList.remove('hidden');
          statusDiv.classList.add('hidden');
          
          totalIssuesNum.textContent = totalIssues;
          currentIssueIndex = 0;
          
          if (totalIssues > 0) {
            currentIssueIndex = 1;
            currentIssueNum.textContent = currentIssueIndex;
            showCurrentIssue();
          }
          
          updateNavigationButtons();
        }
      } else {
        const errorMsg = response?.error || 'Analysis failed';
        console.error('Analysis error:', errorMsg);
        showError(errorMsg);
        navigationControls.classList.remove('hidden');
      }
    });
    
  } catch (error) {
    showError(error.message);
    navigationControls.classList.remove('hidden');
  }
});

// Обработчик кнопки "View Results"
viewResultsBtn.addEventListener('click', () => {
  const resultPageUrl = chrome.runtime.getURL('results/results.html');
  chrome.tabs.create({ url: resultPageUrl });
});

// Обработчик кнопки "Очистить хранилище"
clearStorageBtn.addEventListener('click', async () => {
  if (confirm('Вы уверены, что хотите удалить все сохраненные отчеты?')) {
    try {
      // Очищаем все данные из storage
      await chrome.storage.local.clear();
      console.log('Storage cleared successfully');
      
      // Сбрасываем локальные переменные
      currentAnalysisData = null;
      currentIssueIndex = 0;
      totalIssues = 0;
      
      // Скрываем навигацию и показываем кнопку анализа
      navigationControls.classList.add('hidden');
      analyzeBtn.classList.remove('hidden');
      analyzeBtn.disabled = false;
      
      // Показываем уведомление об успехе
      statusDiv.classList.remove('hidden');
      statusText.textContent = 'Хранилище очищено!';
      
      setTimeout(() => {
        statusDiv.classList.add('hidden');
      }, 2000);
      
    } catch (error) {
      console.error('Error clearing storage:', error);
      showError('Ошибка при очистке хранилища');
    }
  }
});

// Функция для показа текущей ошибки
async function showCurrentIssue() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const targetTabId = activeTab?.id || currentTabId;
    
    if (!currentAnalysisData) {
      throw new Error('No analysis data');
    }
    
    // Проверяем, что мы на той же странице
    const currentUrl = activeTab?.url;
    if (!currentUrl || !currentAnalysisData) {
      console.log('No URL or analysis data');
      return;
    }
    
    // Сохраняем текущий индекс для конкретного URL
    const issueIndexKey = `issueIndex_${currentUrl}`;
    await safeStorageSet({ 
      [issueIndexKey]: currentIssueIndex,
      currentTabId: targetTabId
    });
    
    // Инжектим content script если нужно
    await injectContentScript(targetTabId);
    
    // Отправляем сообщение показать конкретную ошибку
    await chrome.tabs.sendMessage(targetTabId, {
      action: 'showSingleIssue',
      violations: currentAnalysisData.axeResults.violations,
      backendReport: currentAnalysisData.backendReport,
      issueIndex: currentIssueIndex - 1 // 0-based index
    });
    
    console.log('Showing issue:', currentIssueIndex);
  } catch (error) {
    console.error('Failed to show issue:', error);
  }
}

// Функция для показа всех ошибок
async function showAllIssues() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const targetTabId = activeTab?.id || currentTabId;
    
    if (!currentAnalysisData) {
      throw new Error('No analysis data');
    }
    
    // Проверяем, что мы на той же странице
    const currentUrl = activeTab?.url;
    if (!currentUrl || !currentAnalysisData) {
      console.log('No URL or analysis data');
      return;
    }
    
    await injectContentScript(targetTabId);
    
    await chrome.tabs.sendMessage(targetTabId, {
      action: 'toggleHighlight',
      violations: currentAnalysisData.axeResults.violations,
      backendReport: currentAnalysisData.backendReport,
      enabled: true
    });
    
    console.log('Showing all issues');
  } catch (error) {
    console.error('Failed to show all issues:', error);
  }
}

// Функция для инжекта content script
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content/content.js']
    });
    
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ['content/highlight.css']
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (error) {
    // Игнорируем ошибку если скрипт уже загружен
  }
}

// Функция для обновления состояния кнопок навигации
function updateNavigationButtons() {
  prevIssueBtn.disabled = currentIssueIndex <= 1;
  nextIssueBtn.disabled = currentIssueIndex >= totalIssues;
}
