// Default Configuration
const DEFAULT_CONFIG = {
    title: '弓道部 行事出席確認',
    fields: [
        { id: 'name', label: '名前', type: 'text', placeholder: '氏名を入力してください', required: true },
        { id: 'grade', label: '学年', type: 'radio', options: ['1年', '2年'], required: true },
        { id: 'gender', label: '性別', type: 'radio', options: ['男子', '女子'], required: true },
        { id: 'attendance', label: '参加・不参加', type: 'radio', options: ['参加', '不参加'], required: true }
    ],
    successMessage: '回答を送信しました。ありがとうございました。'
};

let currentConfig = JSON.parse(localStorage.getItem('kyudo_config')) || DEFAULT_CONFIG;

// Initial Render
document.addEventListener('DOMContentLoaded', () => {
    renderForm();
});

function renderForm() {
    const titleEl = document.getElementById('app-title');
    const fieldsContainer = document.getElementById('dynamic-fields');
    const successText = document.getElementById('success-text');

    titleEl.textContent = currentConfig.title;
    successText.textContent = currentConfig.successMessage;
    fieldsContainer.innerHTML = '';

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
        timestamp: new Date().toLocaleString('ja-JP')
    };

    currentConfig.fields.forEach(field => {
        submission[field.label] = formData.get(field.id);
    });

    saveData(submission);
    showSuccess();
});

function getDataKey() {
    return `kyudo_attendance_${currentConfig.title}`;
}

function saveData(data) {
    const key = getDataKey();
    let existingData = JSON.parse(localStorage.getItem(key) || '[]');
    existingData.push(data);
    localStorage.setItem(key, JSON.stringify(existingData));
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

function openAdminModal() {
    const modal = document.getElementById('admin-modal');
    updateHistoryListUI();
    populateFilterOptions();
    renderTable();
    populateConfigInputs();
    modal.style.display = 'flex';
}

function updateHistoryListUI() {
    const history = JSON.parse(localStorage.getItem('kyudo_titles_list') || '[]');
    const select = document.getElementById('survey-history');
    
    // Ensure current title is in history if it's not empty
    if (currentConfig.title && !history.includes(currentConfig.title)) {
        history.push(currentConfig.title);
        localStorage.setItem('kyudo_titles_list', JSON.stringify(history));
    }

    select.innerHTML = '';
    history.forEach(title => {
        const opt = document.createElement('option');
        opt.value = title;
        opt.textContent = title;
        if (title === currentConfig.title) opt.selected = true;
        select.appendChild(opt);
    });
}

function switchSurveyView() {
    const selectedTitle = document.getElementById('survey-history').value;
    renderTable(selectedTitle);
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

function renderTable(targetTitle) {
    const title = targetTitle || currentConfig.title;
    const key = `kyudo_attendance_${title}`;
    const data = JSON.parse(localStorage.getItem(key) || '[]');
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

function clearData() {
    if (confirm(`「${currentConfig.title}」のデータを全て削除してもよろしいですか？`)) {
        localStorage.removeItem(getDataKey());
        renderTable();
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
}

function saveConfig() {
    const newTitle = document.getElementById('config-title').value;
    const newGrades = document.getElementById('config-grades').value.split(',').map(s => s.trim()).filter(s => s);
    const newGenders = document.getElementById('config-genders').value.split(',').map(s => s.trim()).filter(s => s);
    const newAttendance = document.getElementById('config-attendance').value.split(',').map(s => s.trim()).filter(s => s);

    if (!newTitle || newGrades.length === 0 || newGenders.length === 0 || newAttendance.length === 0) {
        alert('全ての項目を正しく入力してください。');
        return;
    }

    // Update config object
    currentConfig.title = newTitle;
    currentConfig.fields.find(f => f.id === 'grade').options = newGrades;
    currentConfig.fields.find(f => f.id === 'gender').options = newGenders;
    currentConfig.fields.find(f => f.id === 'attendance').options = newAttendance;

    // Update history list
    let history = JSON.parse(localStorage.getItem('kyudo_titles_list') || '[]');
    if (!history.includes(newTitle)) {
        history.push(newTitle);
        localStorage.setItem('kyudo_titles_list', JSON.stringify(history));
    }

    localStorage.setItem('kyudo_config', JSON.stringify(currentConfig));
    alert('設定を保存しました。');
    updateHistoryListUI();
    populateFilterOptions();
    renderForm();
    showTab('data'); // Go back to data tab
}
