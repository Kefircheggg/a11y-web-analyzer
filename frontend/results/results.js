let analysisData = null;
let originalTabId = null;

const API_BASE_URL = 'https://community.ofmmarket.com/api/api/v1';

const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const resultsContent = document.getElementById('resultsContent');
const backToPageBtn = document.getElementById('backToPageBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const downloadStatus = document.getElementById('downloadStatus');

const criticalCount = document.getElementById('criticalCount');
const seriousCount = document.getElementById('seriousCount');
const moderateCount = document.getElementById('moderateCount');
const minorCount = document.getElementById('minorCount');

const pageUrl = document.getElementById('pageUrl');
const analysisTime = document.getElementById('analysisTime');

const recommendationsContainer = document.getElementById('recommendationsContainer');
const violationsList = document.getElementById('violationsList');

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const result = await chrome.storage.local.get('latestAnalysis');
    
    if (!result.latestAnalysis) {
      throw new Error('No analysis data found');
    }
    
    analysisData = result.latestAnalysis;
    originalTabId = analysisData.tabId;
    
    displayResults();
    
  } catch (error) {
    showError(error.message);
  }
});

function displayResults() {
  loadingState.classList.add('hidden');
  resultsContent.classList.remove('hidden');
  
  const { axeResults, backendReport, useBackendData } = analysisData;
  
  const pdfAvailable = useBackendData && backendReport && backendReport.job_id;
  if (!pdfAvailable) {
    downloadPdfBtn.disabled = true;
    downloadPdfBtn.title = 'PDF отчет доступен только при использовании backend анализа';
    downloadPdfBtn.style.opacity = '0.5';
    downloadPdfBtn.style.cursor = 'not-allowed';
  }
  
  // Устанавливаем заголовок страницы с названием сайта
  try {
    const url = new URL(axeResults.url);
    const siteName = url.hostname.replace(/^www\./, '');
    document.title = `${siteName} - Analysis`;
  } catch (e) {
    document.title = 'Analysis Results';
  }
  
  let counts = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0
  };
  
  if (useBackendData && backendReport && backendReport.summary) {
    counts = {
      critical: backendReport.summary.critical || 0,
      serious: backendReport.summary.serious || 0,
      moderate: backendReport.summary.moderate || 0,
      minor: backendReport.summary.minor || 0
    };
  } else {
    axeResults.violations.forEach(violation => {
      if (counts.hasOwnProperty(violation.impact)) {
        counts[violation.impact] += violation.nodes.length;
      }
    });
  }
  
  criticalCount.textContent = counts.critical;
  seriousCount.textContent = counts.serious;
  moderateCount.textContent = counts.moderate;
  minorCount.textContent = counts.minor;
  
  pageUrl.textContent = `URL: ${axeResults.url}`;
  const date = new Date(analysisData.timestamp);
  analysisTime.textContent = `Проанализировано: ${date.toLocaleString('ru-RU')}`;
  
  displayRecommendations(backendReport, useBackendData);
  
  displayViolations(axeResults.violations, backendReport, useBackendData);
}

function displayRecommendations(backendReport, useBackendData) {
  if (useBackendData && backendReport) {
    recommendationsContainer.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <div class="loader-small" aria-hidden="true"></div>
        <p style="color: #6b7280; margin-top: 10px;">Загрузка рекомендаций AI...</p>
      </div>
    `;
    
    // Получаем job_id из данных анализа
    let jobId = backendReport.job_id 
             || backendReport.jobId 
             || backendReport.id;
    
    if (!jobId) {
      console.error('Job ID not found for recommendations');
      recommendationsContainer.innerHTML = `
        <div style="
          padding: 20px;
          background: #fef3c7;
          border-radius: 8px;
          color: #78350f;
          line-height: 1.6;
        ">
          ⚠️ Не удалось загрузить рекомендации: Job ID не найден.
        </div>
      `;
      return;
    }
    
    // Загружаем summary с backend
    fetch(`${API_BASE_URL}/jobs/${jobId}/report/summary`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Ошибка сервера: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Received AI summary:', data);
        
        if (data.summary) {
          // Отображаем рекомендации из summary
          recommendationsContainer.innerHTML = `
            <div style="
              color: white;
              padding: 24px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              line-height: 1.8;
              white-space: pre-wrap;
              font-size: 14px;
              background: linear-gradient(135deg, #fa4c4c 0%, #000000 100%);
            ">
              ${escapeHtml(data.summary)}
            </div>
          `;
        } else {
          throw new Error('Summary не найден в ответе');
        }
      })
      .catch(error => {
        console.error('Error loading recommendations:', error);
        recommendationsContainer.innerHTML = `
          <div style="
            padding: 20px;
            background: #fee2e2;
            border-radius: 8px;
            color: #991b1b;
            line-height: 1.6;
          ">
            ⚠️ Не удалось загрузить рекомендации AI: ${escapeHtml(error.message)}
          </div>
        `;
      });
  } else {
    recommendationsContainer.innerHTML = `
      <div style="
        padding: 20px;
        background: #fef3c7;
        border-radius: 8px;
        color: #78350f;
        line-height: 1.6;
      ">
        ⚠️ Backend недоступен. Показаны только результаты axe-core.
        <p style="margin-top: 10px; font-size: 13px; color: #92400e;">
          Настройте URL backend в <code>background/background.js</code> (API_BASE_URL) для получения рекомендаций AI.
        </p>
      </div>
    `;
  }
}

function displayViolations(violations, backendReport, useBackendData) {
  if (violations.length === 0) {
    violationsList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #6b7280;">
        <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
        <h3>No accessibility issues found!</h3>
        <p>Great job! Your page follows accessibility best practices.</p>
      </div>
    `;
    return;
  }
  
  const backendIssuesMap = {};
  if (useBackendData && backendReport && backendReport.issues_by_impact) {
    Object.values(backendReport.issues_by_impact).flat().forEach(issue => {
      backendIssuesMap[issue.id] = issue;
    });
  }
  
  const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  violations.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);
  
  let globalElementIndex = 0;
  
  violationsList.innerHTML = violations.map(violation => {
    const elementsInViolation = [];
    violation.nodes.forEach(node => {
      node.target.forEach(selector => {
        globalElementIndex++;
        elementsInViolation.push({
          index: globalElementIndex,
          selector: selector,
          html: node.html,
          failureSummary: node.failureSummary
        });
      });
    });
    
    const backendIssue = backendIssuesMap[violation.id];
    const title = (backendIssue && backendIssue.title) ? backendIssue.title : translate(violation.help);
    const description = (backendIssue && backendIssue.description) ? backendIssue.description : translate(violation.description);
    const howToFix = (backendIssue && backendIssue.how_to_fix) ? backendIssue.how_to_fix : (violation.nodes[0] && violation.nodes[0].failureSummary ? translate(violation.nodes[0].failureSummary) : null);
    
    return `
      <div class="violation-card ${violation.impact}">
        <div class="violation-header">
          <div class="violation-title">
            <h3>${escapeHtml(title)}</h3>
            <p class="violation-description">${escapeHtml(description)}</p>
          </div>
          <span class="violation-badge ${violation.impact}">${translate(violation.impact)}</span>
        </div>
        
        <div class="violation-details">
          <div class="violation-detail-item">
            <strong>${translate('Affected Elements')}:</strong>
            <p>${elementsInViolation.length} ${translate('elements')}</p>
            <div class="violation-nodes">
              ${elementsInViolation.slice(0, 5).map(elem => `
                <div class="violation-node">
                  <span class="element-number">#${elem.index}</span>
                  <code>${escapeHtml(elem.html.substring(0, 100))}${elem.html.length > 100 ? '...' : ''}</code>
                </div>
              `).join('')}
              ${elementsInViolation.length > 5 ? `
                <p style="color: #6b7280; font-size: 13px; margin-top: 8px;">
                  ... и еще ${elementsInViolation.length - 5} (элементы #${elementsInViolation[5].index} - #${elementsInViolation[elementsInViolation.length - 1].index})
                </p>
              ` : ''}
            </div>
          </div>
          
          ${howToFix ? `
            <div class="violation-detail-item">
              <strong>${translate('How to Fix')}:</strong>
              <p>${escapeHtml(howToFix)}</p>
            </div>
          ` : ''}
          
          <a href="${violation.helpUrl}" target="_blank" class="violation-link">
            ${translate('Learn more')} →
          </a>
        </div>
      </div>
    `;
  }).join('');
}

backToPageBtn.addEventListener('click', async () => {
  try {
    await chrome.tabs.update(originalTabId, { active: true });
    window.close();
  } catch (error) {
    console.error('Failed to switch to tab:', error);
  }
});

downloadPdfBtn.addEventListener('click', async () => {
  try {
    downloadStatus.classList.remove('hidden', 'success', 'error');
    downloadStatus.classList.add('loading');
    downloadStatus.textContent = 'Генерация PDF отчета...';
    downloadPdfBtn.disabled = true;
    
    console.log('analysisData:', analysisData);
    console.log('backendReport:', analysisData?.backendReport);
    
    let jobId = analysisData?.backendReport?.job_id 
             || analysisData?.backendReport?.jobId 
             || analysisData?.backendReport?.id
             || analysisData?.job_id
             || analysisData?.jobId;
    
    if (!jobId) {
      console.error('Job ID not found. Available data:', {
        backendReport: analysisData?.backendReport,
        analysisDataKeys: Object.keys(analysisData || {})
      });
      
      if (!analysisData?.useBackendData || !analysisData?.backendReport) {
        throw new Error('PDF отчет недоступен: анализ выполнен только через ядро без backend обработки.');
      }
      
      if (analysisData?.backendReport?.error) {
        throw new Error(`PDF отчет недоступен: ${analysisData.backendReport.error}`);
      }
      
      throw new Error('Job ID не найден в данных анализа. Попробуйте выполнить анализ заново.');
    }
    
    console.log('Using job_id:', jobId);
    
    const pdfUrl = `${API_BASE_URL}/jobs/${jobId}/report/pdf`;
    console.log('Downloading PDF from:', pdfUrl);
    
    const response = await fetch(pdfUrl);
    
    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `accessibility-report-${jobId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(blobUrl);
    
    downloadStatus.classList.remove('loading');
    downloadStatus.classList.add('success');
    downloadStatus.textContent = '✓ PDF отчет успешно скачан!';
    
    setTimeout(() => {
      downloadStatus.classList.add('hidden');
      downloadPdfBtn.disabled = false;
    }, 3000);
    
  } catch (error) {
    console.error('Error downloading PDF:', error);
    
    downloadStatus.classList.remove('loading');
    downloadStatus.classList.add('error');
    downloadStatus.textContent = `Ошибка: ${error.message}`;
    
    downloadPdfBtn.disabled = false;
    
    setTimeout(() => {
      downloadStatus.classList.add('hidden');
    }, 5000);
  }
});

function showError(message) {
  loadingState.classList.add('hidden');
  resultsContent.classList.add('hidden');
  errorState.classList.remove('hidden');
  errorMessage.textContent = message;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
