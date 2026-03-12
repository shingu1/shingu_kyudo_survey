// Default Configuration
const DEFAULT_CONFIG = {
    title: '弓道部 行事出席確認',
    fields: [
        { id: 'name', label: '名前', type: 'text', placeholder: '氏名を入力してください', required: true },
        { id: 'grade', label: '学年', type: 'radio', options: ['1年', '2年'], required: true },
        { id: 'gender', label: '性別', type: 'radio', options: ['男子', '女子'], required: true },
        { id: 'attendance', label: '参加・不参加', type: 'radio', options: ['参加', '不参加'], required: true }
    ],
    successMessage: '回答を送信しました。ありがとうございました。',
    gasUrl: 'https://script.google.com/macros/s/AKfycbyXFOTQ1FuZcYiqM6_ozecbY-y3elTbcO74zkNKiPHG8Jh_pUIyFYKcC1Ndq3TNbpqmaw/exec' // URL for Google Apps Script synchronization
};

function showLoading() {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.style.display = 'flex';
}

function hideLoading() {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.style.display = 'none';
}

let currentConfig = JSON.parse(localStorage.getItem('kyudo_config')) || DEFAULT_CONFIG;

// Force inject the specific URL if none exists or if it's currently using the placeholder
if (!currentConfig.gasUrl) {
    currentConfig.gasUrl = DEFAULT_CONFIG.gasUrl;
}

// Initial Render
document.addEventListener('DOMContentLoaded', async () => {
    await syncConfigFromGAS();
    renderForm();
    
    // Start background polling (every 60 seconds)
    setInterval(() => {
        syncConfigFromGAS(true).then(changed => {
            if (changed) {
                renderForm();
                if (document.getElementById('admin-modal').style.display === 'flex') {
                    updateHistoryListUI();
                    populateConfigInputs();
                    populateFilterOptions();
                }
            }
        });
    }, 60000);
});

async function syncConfigFromGAS(silent = false) {
    if (!currentConfig.gasUrl) return;
    
    updateSyncStatus('読み込み中...', '#666');
    if (!silent) showLoading();
    
    try {
        const cacheBuster = `&_cb=${Date.now()}`;
        const response = await fetch(`${currentConfig.gasUrl}?action=getConfig${cacheBuster}`);
        const remoteConfig = await response.json();
        
        if (remoteConfig && typeof remoteConfig === 'object' && remoteConfig.title) {
            // Check if anything has changed
            const configString = JSON.stringify(currentConfig);
            const remoteString = JSON.stringify(remoteConfig);
            
            if (configString !== remoteString) {
                currentConfig = remoteConfig;
                localStorage.setItem('kyudo_config', JSON.stringify(currentConfig));
                updateSyncStatus('最新の状態です (更新あり)', '#2e7d32');
                if (!silent) hideLoading();
                return true; // Config changed
            }
            
            updateSyncStatus('最新の状態です', '#2e7d32');
            if (!silent) hideLoading();
            return false;
        } else {
            updateSyncStatus('同期済み（クラウド設定なし）', '#666');
            if (!silent) hideLoading();
            return false; 
        }
    } catch (err) {
        console.error('Failed to sync config:', err);
        updateSyncStatus('同期エラー', '#f44336');
        if (!silent) hideLoading();
        return false;
    }
}

async function testConnection() {
    const url = document.getElementById('config-gas-url').value.trim();
    const resultEl = document.getElementById('connection-test-result');
    if (!url) {
        resultEl.textContent = '❌ URLを入力してください';
        resultEl.style.color = '#f44336';
        return;
    }

    resultEl.textContent = '⏳ 接続テスト中...';
    resultEl.style.color = '#666';

    try {
        const response = await fetch(`${url}?action=test`);
        const data = await response.json();
        if (data && data.success) {
            resultEl.textContent = '✅ 接続成功！';
            resultEl.style.color = '#2e7d32';
        } else {
            console.log('Unexpected response:', data);
            if (Array.isArray(data)) {
                resultEl.textContent = '❌ 旧バージョンのスクリプトです（新しくデプロイしてください）';
            } else {
                resultEl.textContent = '❌ 応答が不正です（GASの設定を確認してください）';
            }
            resultEl.style.color = '#f44336';
        }
    } catch (err) {
        console.error('Connection test failed:', err);
        resultEl.textContent = `❌ 接続失敗: ${err.message} (URLが正しいか確認してください)`;
        resultEl.style.color = '#f44336';
    } finally {
        hideLoading();
    }
}

function updateSyncStatus(msg, color) {
    const el = document.getElementById('sync-message');
    if (el) {
        el.textContent = `同期ステータス: ${msg}`;
        el.style.color = color;
    }
}

async function manualSync() {
    // Manual sync logic removed as background polling is now active
    await syncConfigFromGAS();
    renderForm();
    await updateHistoryListUI();
    renderTable();
}

function renderForm() {
    const titleEl = document.getElementById('app-title');
    const fieldsContainer = document.getElementById('dynamic-fields');
    const successText = document.getElementById('success-text');
    const form = document.getElementById('attendance-form');

    titleEl.textContent = currentConfig.title;
    successText.textContent = currentConfig.successMessage;
    fieldsContainer.innerHTML = '';

    if (currentConfig.title === '現在アンケートはありません。') {
        fieldsContainer.innerHTML = '<div style="text-align:center; padding: 40px 0; color: #666; font-size: 1.1rem;">現在実施中のアンケートはありません。</div>';
        form.querySelector('button[type="submit"]').style.display = 'none';
        return;
    }

    form.querySelector('button[type="submit"]').style.display = 'block';

    currentConfig.fields.forEach(field => {
        const group = document.createElement('div');
        group.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = field.label;
        group.appendChild(label);

        if (field.type === 'text') {
            const input = document.createElement('input');
            input.type = 'text';
            input.name = field.id;
            input.id = field.id;
            input.placeholder = field.placeholder || '';
            input.required = field.required;
            group.appendChild(input);
        } else if (field.type === 'radio') {
            const radioGroup = document.createElement('div');
            radioGroup.className = 'radio-group';
            
            field.options.forEach((opt, idx) => {
                const optLabel = document.createElement('label');
                optLabel.className = 'radio-option';
                
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = field.id;
                input.value = opt;
                if (idx === 0 && field.required) input.required = true;
                
                optLabel.appendChild(input);
                optLabel.append(` ${opt}`);
                radioGroup.appendChild(optLabel);
            });
            group.appendChild(radioGroup);
        }
        
        fieldsContainer.appendChild(group);
    });
}

// Form Submission
document.getElementById('attendance-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = new FormData(this);
    const submission = {
        items: {},
        title: currentConfig.title
    };

    currentConfig.fields.forEach(field => {
        submission.items[field.label] = formData.get(field.id);
        submission[field.label] = formData.get(field.id);
    });

    saveData(submission);
    showSuccess();
});

function getDataKey() {
    return `kyudo_attendance_${currentConfig.title}`;
}

async function saveData(data) {
    // Local save
    const key = getDataKey();
    let existingData = JSON.parse(localStorage.getItem(key) || '[]');
    existingData.push(data);
    localStorage.setItem(key, JSON.stringify(existingData));

    // GAS Save
    if (currentConfig.gasUrl) {
        const statusEl = document.getElementById('submission-sync-status');
        if (statusEl) statusEl.textContent = 'クラウドへ送信中...';
        showLoading();
        
        try {
            const response = await fetch(currentConfig.gasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Use text/plain to avoid CORS preflight in some environments
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (result && result.success) {
                if (statusEl) {
                    statusEl.textContent = 'クラウド同期完了';
                    statusEl.style.color = '#2e7d32';
                }
                // Update local storage with the server-side timestamp
                if (result.timestamp) {
                    const key = getDataKey();
                    let existingData = JSON.parse(localStorage.getItem(key) || '[]');
                    const lastIndex = existingData.length - 1;
                    if (lastIndex >= 0) {
                        existingData[lastIndex].timestamp = result.timestamp;
                        localStorage.setItem(key, JSON.stringify(existingData));
                    }
                }
            }
        } catch (err) {
            console.error('GAS Save failed:', err);
            if (statusEl) {
                statusEl.textContent = 'クラウド同期失敗（オフライン保存済）';
                statusEl.style.color = '#f44336';
            }
        } finally {
            hideLoading();
        }
    }
}

function showSuccess() {
    document.getElementById('attendance-form').style.display = 'none';
    document.getElementById('success-message').style.display = 'flex';
}

// Admin Logic
document.getElementById('open-admin').addEventListener('click', function() {
    const password = prompt('パスワードを入力してください:');
    if (password === '0000') {
        openAdminModal();
    } else if (password !== null) {
        alert('パスワードが違います。');
    }
});

async function openAdminModal() {
    const modal = document.getElementById('admin-modal');
    showLoading();
    await updateHistoryListUI();
    populateFilterOptions();
    await renderTable();
    populateConfigInputs();
    hideLoading();
    modal.style.display = 'flex';
}

async function updateHistoryListUI() {
    const select = document.getElementById('survey-history');
    if (!select) return;

    let history = JSON.parse(localStorage.getItem('kyudo_titles_list') || '[]');
    
    // Fetch from GAS if available
    if (currentConfig.gasUrl) {
        try {
            const cacheBuster = `&_cb=${Date.now()}`;
            const response = await fetch(`${currentConfig.gasUrl}?action=getHistory${cacheBuster}`);
            const remoteHistory = await response.json();
            if (Array.isArray(remoteHistory)) {
                history = remoteHistory;
                localStorage.setItem('kyudo_titles_list', JSON.stringify(history));
            }
        } catch (err) {
            console.error('Failed to fetch remote history:', err);
        }
    }

    // Ensure current title is in history
    if (currentConfig.title && !history.includes(currentConfig.title)) {
        history.push(currentConfig.title);
    }

    // Add "No Survey" option if not present
    const noSurveyOption = '現在アンケートはありません。';
    if (!history.includes(noSurveyOption)) {
        history.unshift(noSurveyOption);
    }

    select.innerHTML = '';
    history.forEach(title => {
        const opt = document.createElement('option');
        opt.value = title;
        opt.textContent = (title === currentConfig.title) ? `【実施中】${title}` : title;
        opt.selected = (title === currentConfig.title);
        select.appendChild(opt);
    });

    updateSurveyStatusInfo();
}

function updateSurveyStatusInfo() {
    const list = document.getElementById('survey-history');
    const selectedTitle = list.value;
    const activeBadge = document.getElementById('active-badge');
    const setActiveBtn = document.getElementById('set-active-btn');

    if (selectedTitle === currentConfig.title) {
        activeBadge.style.display = 'inline-block';
        setActiveBtn.style.display = 'none';
    } else {
        activeBadge.style.display = 'none';
        setActiveBtn.style.display = 'inline-block';
    }
}

function switchSurveyView() {
    const selectedTitle = document.getElementById('survey-history').value;
    updateSurveyStatusInfo();
    renderTable(selectedTitle);
}

async function setActiveSurvey() {
    const selectedTitle = document.getElementById('survey-history').value;
    if (!selectedTitle) return;

    if (!confirm(`「${selectedTitle}」を現在実施中のアンケートとして公開しますか？`)) return;

    // To properly "set active", we need the config for that survey.
    // However, we only store data by title. If we switch title, we're essentially
    // changing the current title. The fields and other settings remain the same.
    currentConfig.title = selectedTitle;
    
    showLoading();
    try {
        localStorage.setItem('kyudo_config', JSON.stringify(currentConfig));
        
        if (currentConfig.gasUrl) {
            updateSyncStatus('読み込み中...', '#666');
            await fetch(currentConfig.gasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ type: 'config', config: currentConfig })
            });
            updateSyncStatus('同期完了', '#2e7d32');
        }
        
        alert('実施中のアンケートを切り替えました。');
        renderForm();
        updateHistoryListUI();
        renderTable();
    } catch (err) {
        console.error('Failed to set active survey:', err);
        alert('切り替えに失敗しました。');
    } finally {
        hideLoading();
    }
}

function showTab(tabName) {
    // Hide all contents
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    // Show selected
    document.getElementById(`tab-${tabName}`).style.display = 'block';
    event.currentTarget.classList.add('active');
}

document.getElementById('close-modal').addEventListener('click', function() {
    document.getElementById('admin-modal').style.display = 'none';
});

window.onclick = function(event) {
    const modal = document.getElementById('admin-modal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

function populateFilterOptions() {
    const gradeSelect = document.getElementById('filter-grade');
    const genderSelect = document.getElementById('filter-gender');
    const responseSelect = document.getElementById('filter-response');

    const updateSelect = (select, options) => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">すべて</option>';
        options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            select.appendChild(o);
        });
        select.value = currentValue;
    };

    updateSelect(gradeSelect, currentConfig.fields.find(f => f.id === 'grade').options);
    updateSelect(genderSelect, currentConfig.fields.find(f => f.id === 'gender').options);
    updateSelect(responseSelect, currentConfig.fields.find(f => f.id === 'attendance').options);
}

async function renderTable(targetTitle) {
    const title = targetTitle || currentConfig.title;
    const key = `kyudo_attendance_${title}`;
    let data = JSON.parse(localStorage.getItem(key) || '[]');

    // Fetch from GAS if available
    if (currentConfig.gasUrl) {
        showLoading();
        try {
            const cacheBuster = `&_cb=${Date.now()}`;
            const response = await fetch(`${currentConfig.gasUrl}?title=${encodeURIComponent(title)}${cacheBuster}`);
            const remoteData = await response.json();
            if (Array.isArray(remoteData)) {
                data = remoteData;
                // Cache to local
                localStorage.setItem(key, JSON.stringify(data));
            }
        } catch (err) {
            console.error('GAS fetch failed:', err);
        } finally {
            hideLoading();
        }
    }

    const tbody = document.getElementById('attendance-data-body');
    const theadRow = document.querySelector('#tab-data table thead tr');

    // Filter Logic
    const filterName = document.getElementById('filter-name').value.toLowerCase();
    const filterGrade = document.getElementById('filter-grade').value;
    const filterGender = document.getElementById('filter-gender').value;
    const filterResponse = document.getElementById('filter-response').value;

    const filteredData = data.filter(item => {
        // Find fields in config, but if title is different, we look for matching labels in the item
        const nameField = currentConfig.fields.find(f => f.id === 'name');
        const gradeField = currentConfig.fields.find(f => f.id === 'grade');
        const genderField = currentConfig.fields.find(f => f.id === 'gender');
        const attendanceField = currentConfig.fields.find(f => f.id === 'attendance');

        const getValue = (field, item) => field ? item[field.label] : null;

        const matchesName = nameField && item[nameField.label] ? item[nameField.label].toLowerCase().includes(filterName) : true;
        const matchesGrade = filterGrade ? item[gradeField.label] === filterGrade : true;
        const matchesGender = filterGender ? item[genderField.label] === filterGender : true;
        const matchesResponse = filterResponse ? item[attendanceField.label] === filterResponse : true;
        
        return matchesName && matchesGrade && matchesGender && matchesResponse;
    });
    
    // Dynamically update headers based on current config labels
    theadRow.innerHTML = '<th>日時</th>';
    currentConfig.fields.forEach(field => {
        const th = document.createElement('th');
        th.textContent = field.label;
        theadRow.appendChild(th);
    });

    tbody.innerHTML = '';
    filteredData.reverse().forEach(item => {
        const row = document.createElement('tr');
        let cols = `<td>${item.timestamp}</td>`;
        currentConfig.fields.forEach(field => {
            cols += `<td>${item[field.label] || '-'}</td>`;
        });
        row.innerHTML = cols;
        tbody.appendChild(row);
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${currentConfig.fields.length + 1}" style="text-align:center;">条件に一致するデータがありません</td></tr>`;
    }
}

async function clearData() {
    const title = currentConfig.title;
    if (confirm(`「${title}」のデータを全て削除（リセット）してもよろしいですか？\nこの操作はクラウド上のデータも削除されます。`)) {
        showLoading();
        try {
            // Local clear
            localStorage.removeItem(getDataKey());
            
            // Cloud clear
            if (currentConfig.gasUrl) {
                const response = await fetch(currentConfig.gasUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ type: 'clearSheetData', title: title })
                });
                const result = await response.json();
                if (result.success) {
                    alert('データをリセットしました。');
                } else {
                    alert('ローカルデータは削除されましたが、クラウドのリセットに失敗しました。');
                }
            } else {
                alert('データをリセットしました。');
            }
            renderTable();
        } catch (err) {
            console.error('Clear data failed:', err);
            alert('リセット中にエラーが発生しました。');
        } finally {
            hideLoading();
        }
    }
}

// Config Editor Logic
function populateConfigInputs() {
    document.getElementById('config-title').value = currentConfig.title;
    
    // Find fields by ID for convenience mapping
    const getOptions = (id) => currentConfig.fields.find(f => f.id === id)?.options.join(', ') || '';
    
    document.getElementById('config-grades').value = getOptions('grade');
    document.getElementById('config-genders').value = getOptions('gender');
    document.getElementById('config-attendance').value = getOptions('attendance');
    document.getElementById('config-gas-url').value = currentConfig.gasUrl || '';
}

function saveConfig() {
    const newTitle = document.getElementById('config-title').value;
    const newGrades = document.getElementById('config-grades').value.split(',').map(s => s.trim()).filter(s => s);
    const newGenders = document.getElementById('config-genders').value.split(',').map(s => s.trim()).filter(s => s);
    const newAttendance = document.getElementById('config-attendance').value.split(',').map(s => s.trim()).filter(s => s);
    const gasUrl = document.getElementById('config-gas-url').value.trim();

    if (!newTitle || newGrades.length === 0 || newGenders.length === 0 || newAttendance.length === 0) {
        alert('全ての項目を正しく入力してください。');
        return;
    }

    // Update config object
    currentConfig.title = newTitle;
    currentConfig.fields.find(f => f.id === 'grade').options = newGrades;
    currentConfig.fields.find(f => f.id === 'gender').options = newGenders;
    currentConfig.fields.find(f => f.id === 'attendance').options = newAttendance;
    currentConfig.gasUrl = gasUrl;

    // Update history list
    let history = JSON.parse(localStorage.getItem('kyudo_titles_list') || '[]');
    if (!history.includes(newTitle)) {
        history.push(newTitle);
        localStorage.setItem('kyudo_titles_list', JSON.stringify(history));
    }

    localStorage.setItem('kyudo_config', JSON.stringify(currentConfig));

    // Update GAS Config if URL exists
    if (gasUrl) {
        updateSyncStatus('読み込み中...', '#666');
        showLoading();
        fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ type: 'config', config: currentConfig })
        })
        .then(() => {
            updateSyncStatus('設定の同期完了', '#2e7d32');
            alert('設定を保存し、クラウドと同期しました。');
        })
        .catch(err => {
            console.error('GAS Config push failed:', err);
            updateSyncStatus('同期エラー', '#f44336');
            alert('設定は保存されましたが、クラウドとの同期に失敗しました。');
        })
        .finally(() => {
            hideLoading();
        });
    } else {
        alert('設定を保存しました。');
    }
    updateHistoryListUI();
    populateFilterOptions();
    renderForm();
    showTab('data'); // Go back to data tab
}
