/**
 * Модуль для работы с Chrome Storage
 */

const MAX_STORED_REPORTS = 1;

/**
 * Очищает старые отчеты из хранилища
 */
async function cleanupOldStorage() {
  try {
    const storage = await chrome.storage.local.get(null);
    const allAnalyses = storage.allAnalyses || {};
    const urls = Object.keys(allAnalyses);
    
    if (urls.length > MAX_STORED_REPORTS) {
      console.log(`Found ${urls.length} stored reports, cleaning up...`);
      
      // Сортируем по времени
      const urlsWithTime = urls.map(url => ({
        url: url,
        timestamp: allAnalyses[url].timestamp || 0
      }));
      
      urlsWithTime.sort((a, b) => b.timestamp - a.timestamp);
      
      // Оставляем только последний
      const toKeep = urlsWithTime.slice(0, MAX_STORED_REPORTS);
      const toRemove = urlsWithTime.slice(MAX_STORED_REPORTS);
      
      // Удаляем старые
      for (const item of toRemove) {
        delete allAnalyses[item.url];
        const analysisKey = `analysis_${item.url}`;
        const issueIndexKey = `issueIndex_${item.url}`;
        await chrome.storage.local.remove([analysisKey, issueIndexKey]);
        console.log('Removed old report for:', item.url);
      }
      
      // Сохраняем обновленный список
      await chrome.storage.local.set({ allAnalyses: allAnalyses });
      console.log(`Cleanup complete. Kept ${toKeep.length} recent reports.`);
    } else {
      console.log(`Storage is clean. Found ${urls.length} reports.`);
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

/**
 * Сохраняет данные анализа
 * @param {Object} analysisData - данные анализа
 * @param {string} url - URL страницы
 */
async function saveAnalysisData(analysisData, url) {
  const analysisKey = `analysis_${url}`;
  
  try {
    // Получаем все существующие анализы
    const storage = await chrome.storage.local.get(null);
    let allAnalyses = storage.allAnalyses || {};
    
    // Удаляем старые отчеты, оставляя только последний
    const urls = Object.keys(allAnalyses);
    
    if (urls.length >= MAX_STORED_REPORTS) {
      console.log('Cleaning up old reports before saving new one...');
      
      // Удаляем все старые отчеты
      for (const oldUrl of urls) {
        if (oldUrl !== url) {
          delete allAnalyses[oldUrl];
          
          // Удаляем связанные ключи
          const oldAnalysisKey = `analysis_${oldUrl}`;
          const oldIssueIndexKey = `issueIndex_${oldUrl}`;
          await chrome.storage.local.remove([oldAnalysisKey, oldIssueIndexKey]);
          console.log('Removed old analysis for:', oldUrl);
        }
      }
    }
    
    // Добавляем текущий анализ
    allAnalyses[url] = analysisData;
    
    // Сохраняем только необходимые данные (избегаем дублирования)
    await chrome.storage.local.set({ 
      latestAnalysis: analysisData,
      allAnalyses: allAnalyses
    });
    
    console.log('Analysis saved successfully');
  } catch (storageError) {
    console.error('Storage error:', storageError);
    
    // Если произошла ошибка с хранилищем (например, квота превышена)
    await handleStorageQuotaError(storageError, analysisData, url);
  }
}

/**
 * Обработка ошибки превышения квоты хранилища
 * @param {Error} error - ошибка
 * @param {Object} analysisData - данные для сохранения
 * @param {string} url - URL страницы
 */
async function handleStorageQuotaError(error, analysisData, url) {
  const errorMsg = error.message || '';
  
  if (errorMsg.includes('QUOTA') || errorMsg.includes('quota') || errorMsg.includes('QuotaExceeded')) {
    console.warn('Storage quota exceeded, clearing all old data...');
    
    try {
      await chrome.storage.local.clear();
      
      // Сохраняем только текущий анализ
      const freshAnalyses = {};
      freshAnalyses[url] = analysisData;
      
      await chrome.storage.local.set({ 
        latestAnalysis: analysisData,
        allAnalyses: freshAnalyses
      });
      
      console.log('Storage cleared and new analysis saved');
    } catch (clearError) {
      console.error('Failed to clear storage:', clearError);
      throw clearError;
    }
  } else {
    throw error;
  }
}

/**
 * Получает сохраненные данные анализа по URL
 * @param {string} url - URL страницы
 * @returns {Promise<Object|null>} данные анализа или null
 */
async function getAnalysisData(url) {
  const storage = await chrome.storage.local.get('allAnalyses');
  const allAnalyses = storage.allAnalyses || {};
  return allAnalyses[url] || null;
}
