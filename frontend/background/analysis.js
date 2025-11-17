/**
 * Модуль для выполнения анализа доступности
 */

/**
 * Запускает анализ axe-core на странице
 * @param {string} axeUrl - URL axe-core библиотеки
 * @returns {Promise<Object>} результаты анализа
 */
async function runAxeAnalysis(axeUrl) {
  try {
    console.log('Starting axe analysis...');
    
    if (typeof axe === 'undefined') {
      console.log('axe-core not loaded, injecting script...');
      console.log('Loading from:', axeUrl);
      
      await loadAxeScript(axeUrl);
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

/**
 * Загружает axe-core скрипт
 * @param {string} axeUrl - URL скрипта
 * @returns {Promise<void>}
 */
async function loadAxeScript(axeUrl) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    
    // Handle Trusted Types policy if it exists
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
      try {
        const policy = window.trustedTypes.createPolicy('axe-loader', {
          createScriptURL: (url) => url
        });
        script.src = policy.createScriptURL(axeUrl);
      } catch (e) {
        // Policy might already exist, try to use direct assignment
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
}

/**
 * Выполняет полный анализ страницы
 * @param {number} tabId - ID вкладки
 * @returns {Promise<Object>} данные анализа
 */
async function performFullAnalysis(tabId) {
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
  
  return axeResults;
}
