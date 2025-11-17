/**
 * API модуль для взаимодействия с backend сервером
 */

const API_BASE_URL = 'https://community.ofmmarket.com/api/api/v1';

/**
 * Создает задачу анализа на backend
 * @param {Object} analysisData - данные анализа (url, violations, timestamp)
 * @returns {Promise<string>} job ID
 */
async function createAnalysisJob(analysisData) {
  console.log('🚀 Step 1: Creating analysis job...');
  
  const createJobUrl = `${API_BASE_URL}/analyze`;
  console.log(`   POST ${createJobUrl}`);
  
  const response = await fetch(createJobUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(analysisData)
  });
  
  console.log(`   Response status: ${response.status} ${response.statusText}`);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unable to read error response');
    throw new Error(`Backend returned ${response.status} ${response.statusText}. Response: ${errorText}`);
  }
  
  const jobData = await response.json();
  console.log(`✅ Job created successfully with ID: ${jobData.id}`);
  
  return jobData.id;
}

/**
 * Проверяет статус задачи
 * @param {string} jobId - ID задачи
 * @returns {Promise<Object>} статус и прогресс
 */
async function checkJobStatus(jobId) {
  const statusUrl = `${API_BASE_URL}/jobs/${jobId}`;
  const response = await fetch(statusUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to get job status: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Опрашивает статус задачи до завершения
 * @param {string} jobId - ID задачи
 * @param {number} maxAttempts - максимальное количество попыток
 * @param {number} interval - интервал между попытками (мс)
 * @returns {Promise<string>} финальный статус
 */
async function pollJobStatus(jobId, maxAttempts = 60, interval = 2000) {
  console.log('🔄 Step 2: Polling job status...');
  
  let attempts = 0;
  let jobStatus = 'pending';
  
  while ((jobStatus === 'pending' || jobStatus === 'processing') && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, interval));
    
    const statusData = await checkJobStatus(jobId);
    jobStatus = statusData.status;
    
    console.log(`   ⏳ Attempt ${attempts + 1}/${maxAttempts}: Status = ${jobStatus}, Progress = ${statusData.progress || 0}%`);
    
    attempts++;
  }
  
  return jobStatus;
}

/**
 * Получает отчет по завершенной задаче
 * @param {string} jobId - ID задачи
 * @returns {Promise<Object>} отчет
 */
async function getJobReport(jobId) {
  console.log('📥 Step 3: Fetching report...');
  
  const reportUrl = `${API_BASE_URL}/jobs/${jobId}/report`;
  console.log(`   GET ${reportUrl}`);
  
  const response = await fetch(reportUrl);
  console.log(`   Response status: ${response.status} ${response.statusText}`);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unable to read error response');
    throw new Error(`Failed to fetch report: ${response.status}. Response: ${errorText}`);
  }
  
  const reportData = await response.json();
  console.log('✅ Backend report received successfully');
  console.log(`   - Total issues: ${reportData.summary?.total_issues || 0}`);
  console.log(`   - Recommendations: ${reportData.recommendations?.length || 0}`);
  
  return reportData;
}

/**
 * Полный цикл анализа через backend
 * @param {Object} axeResults - результаты axe-core
 * @returns {Promise<Object>} результат backend анализа
 */
async function performBackendAnalysis(axeResults) {
  console.log(`📡 Backend API: ${API_BASE_URL}`);
  
  let backendReport = null;
  let useBackendData = false;
  
  try {
    // Создаем задачу
    const jobId = await createAnalysisJob({
      url: axeResults.url,
      violations: axeResults.violations,
      timestamp: axeResults.timestamp
    });
    
    backendReport = { job_id: jobId };
    
    // Опрашиваем статус
    const jobStatus = await pollJobStatus(jobId);
    
    if (jobStatus === 'completed') {
      // Получаем отчет
      const reportData = await getJobReport(jobId);
      backendReport = { ...reportData, job_id: jobId };
      useBackendData = true;
    } else if (jobStatus === 'failed') {
      console.warn(`❌ Job failed with status: ${jobStatus}`);
      backendReport = { job_id: jobId, error: 'Job failed' };
    } else {
      console.warn(`⏱️ Job did not complete in time. Final status: ${jobStatus}`);
      backendReport = { job_id: jobId, error: 'Job timed out' };
    }
  } catch (error) {
    console.error('❌ Backend error details:');
    console.error(`   Error type: ${error.name}`);
    console.error(`   Error message: ${error.message}`);
    console.warn('⚠️ Continuing without backend data - using axe-core results only');
    
    throw error;
  }
  
  return { backendReport, useBackendData };
}
