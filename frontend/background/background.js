const API_BASE_URL = 'https://community.ofmmarket.com/api/api/v1';
const MAX_STORED_REPORTS = 1;

chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed/updated, cleaning old storage data...');
  await cleanupOldStorage();
});

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startAnalysis') {
    handleAnalysis(message.tabId, sendResponse);
    return true;
  }
});

async function handleAnalysis(tabId, sendResponse) {
  try {
    console.log('Injecting axe-core...');
    
    const axeUrl = chrome.runtime.getURL('libs/axe-core/axe.min.js');
    console.log('axe-core URL:', axeUrl);
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: runAxeAnalysis,
      args: [axeUrl],
      world: 'MAIN' 
    });
    
    console.log('Script execution results:', results);
    
    if (!results || !results[0]) {
      throw new Error('Script execution failed - no results returned');
    }
    
    const axeResults = results[0].result;
    
    if (axeResults && axeResults.error) {
      throw new Error(axeResults.error);
    }
    
    if (!axeResults) {
      throw new Error('Failed to run axe-core analysis - no result data');
    }
    
    console.log('Axe results:', axeResults);
    
    console.log('Sending results to backend...');
    
    let backendReport = null;
    let useBackendData = false;
    
    try {
      console.log(`📡 Backend API: ${API_BASE_URL}`);
      
      // Шаг 1: Создать задачу
      console.log('🚀 Step 1: Creating analysis job...');
      const createJobUrl = `${API_BASE_URL}/analyze`;
      console.log(`   POST ${createJobUrl}`);
      
      const createJobResponse = await fetch(createJobUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: axeResults.url,
          violations: axeResults.violations,
          timestamp: axeResults.timestamp
        })
      });
      
      console.log(`   Response status: ${createJobResponse.status} ${createJobResponse.statusText}`);
      
      if (!createJobResponse.ok) {
        const errorText = await createJobResponse.text().catch(() => 'Unable to read error response');
        throw new Error(`Backend returned ${createJobResponse.status} ${createJobResponse.statusText}. Response: ${errorText}`);
      }
      
      const jobData = await createJobResponse.json();
      const jobId = jobData.id;
      console.log(`✅ Job created successfully with ID: ${jobId}`);
      
      backendReport = { job_id: jobId };
      
      // Шаг 2: Опрашивать статус (polling)
      console.log('🔄 Step 2: Polling job status...');
      let jobStatus = 'pending';
      let attempts = 0;
      const maxAttempts = 60; // 2 секунды * 60 = 2 минуты максимум
      
      while ((jobStatus === 'pending' || jobStatus === 'processing') && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем 2 секунды
        
        const statusUrl = `${API_BASE_URL}/jobs/${jobId}`;
        const statusResponse = await fetch(statusUrl);
        
        if (!statusResponse.ok) {
          console.error(`   ❌ Status check failed: ${statusResponse.status} ${statusResponse.statusText}`);
          throw new Error(`Failed to get job status: ${statusResponse.status} ${statusResponse.statusText}`);
        }
        
        const statusData = await statusResponse.json();
        jobStatus = statusData.status;
        
        console.log(`   ⏳ Attempt ${attempts + 1}/${maxAttempts}: Status = ${jobStatus}, Progress = ${statusData.progress || 0}%`);
        
        attempts++;
      }
      
      if (jobStatus === 'completed') {
        // Шаг 3: Получить отчет
        console.log('📥 Step 3: Fetching report...');
        const reportUrl = `${API_BASE_URL}/jobs/${jobId}/report`;
        console.log(`   GET ${reportUrl}`);
        
        const reportResponse = await fetch(reportUrl);
        console.log(`   Response status: ${reportResponse.status} ${reportResponse.statusText}`);
        
        if (reportResponse.ok) {
          const reportData = await reportResponse.json();
          // Объединяем jobId с данными отчета
          backendReport = { ...reportData, job_id: jobId };
          useBackendData = true;
          console.log('✅ Backend report received successfully');
          console.log(`   - Total issues: ${backendReport.summary?.total_issues || 0}`);
          console.log(`   - Recommendations: ${backendReport.recommendations?.length || 0}`);
        } else {
          const errorText = await reportResponse.text().catch(() => 'Unable to read error response');
          console.warn(`⚠️ Failed to fetch report: ${reportResponse.status} ${reportResponse.statusText}. Response: ${errorText}`);
          // Сохраняем jobId даже если не удалось получить отчет
          backendReport = { job_id: jobId, error: 'Failed to fetch report' };
        }
      } else if (jobStatus === 'failed') {
        console.warn(`❌ Job failed with status: ${jobStatus}`);
        // Сохраняем jobId даже если задача провалилась
        backendReport = { job_id: jobId, error: 'Job failed' };
      } else {
        console.warn(`⏱️ Job did not complete in time. Final status: ${jobStatus} after ${attempts} attempts`);
        // Сохраняем jobId даже если задача не завершилась
        backendReport = { job_id: jobId, error: 'Job timed out' };
      }
      
    } catch (backendError) {
      console.error('❌ Backend error details:');
      console.error(`   Error type: ${backendError.name}`);
      console.error(`   Error message: ${backendError.message}`);
      console.error(`   Full error:`, backendError);
      console.warn('⚠️ Continuing without backend data - using axe-core results only');
    }
    
    const analysisData = {
      axeResults: axeResults,
      backendReport: backendReport,
      useBackendData: useBackendData,
      tabId: tabId,
      timestamp: Date.now()
    };
    
    // Сохраняем анализ с привязкой к URL
    const analysisKey = `analysis_${axeResults.url}`;
    
    try {
      // Получаем все существующие анализы
      const storage = await chrome.storage.local.get(null);
      let allAnalyses = storage.allAnalyses || {};
      
      // Удаляем старые отчеты, оставляя только последний
      const urls = Object.keys(allAnalyses);
      
      if (urls.length >= MAX_STORED_REPORTS) {
        console.log('Cleaning up old reports before saving new one...');
        
        // Удаляем все старые отчеты
        for (const url of urls) {
          if (url !== axeResults.url) {
            delete allAnalyses[url];
            
            // Удаляем связанные ключи
            const oldAnalysisKey = `analysis_${url}`;
            const oldIssueIndexKey = `issueIndex_${url}`;
            await chrome.storage.local.remove([oldAnalysisKey, oldIssueIndexKey]);
            console.log('Removed old analysis for:', url);
          }
        }
      }
      
      // Добавляем текущий анализ
      allAnalyses[axeResults.url] = analysisData;
      
      // Сохраняем только необходимые данные (избегаем дублирования)
      await chrome.storage.local.set({ 
        latestAnalysis: analysisData,
        allAnalyses: allAnalyses
      });
      
      console.log('Analysis saved successfully');
    } catch (storageError) {
      console.error('Storage error:', storageError);
      
      // Если произошла ошибка с хранилищем (например, квота превышена),
      // очищаем всё хранилище и сохраняем только текущий анализ
      const errorMsg = storageError.message || '';
      if (errorMsg.includes('QUOTA') || errorMsg.includes('quota') || errorMsg.includes('QuotaExceeded')) {
        console.warn('Storage quota exceeded, clearing all old data...');
        
        try {
          await chrome.storage.local.clear();
          
          // Сохраняем только текущий анализ
          const freshAnalyses = {};
          freshAnalyses[axeResults.url] = analysisData;
          
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
        throw storageError;
      }
    }
    
    // Не открываем автоматически страницу с отчетом
    // Пользователь может открыть отчет через popup
    
    sendResponse({ success: true, analysisData: analysisData });
    
  } catch (error) {
    console.error('Analysis error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function runAxeAnalysis(axeUrl) {
  try {
    console.log('Starting axe analysis...');
    
    if (typeof axe === 'undefined') {
      console.log('axe-core not loaded, injecting script...');
      console.log('Loading from:', axeUrl);
      
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        
        // Handle Trusted Types policy if it exists
        if (window.trustedTypes && window.trustedTypes.createPolicy) {
          try {
            const policy = window.trustedTypes.createPolicy('axe-loader', {
              createScriptURL: (url) => url
            });
            script.src = policy.createScriptURL(axeUrl);
          } catch (e) {
            // Policy might already exist, try to use default policy or fallback
            console.log('Trusted Types policy creation failed, using direct assignment:', e);
            script.src = axeUrl;
          }
        } else {
          script.src = axeUrl;
        }
        
        script.onload = () => {
          console.log('axe-core script loaded');
          resolve();
        };
        script.onerror = (error) => {
          console.error('Failed to load script:', error);
          reject(new Error('Failed to load axe-core script'));
        };
        (document.head || document.documentElement).appendChild(script);
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    if (typeof axe === 'undefined') {
      throw new Error('axe-core failed to load - axe is still undefined');
    }
    
    console.log('Running axe.run()...');
    
    const results = await axe.run();
    
    console.log('axe.run() completed, violations:', results.violations.length);
    
    return {
      violations: results.violations,
      passes: results.passes,
      incomplete: results.incomplete,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in runAxeAnalysis:', error);
    return {
      error: error.message || String(error)
    };
  }
}
