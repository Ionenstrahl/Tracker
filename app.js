// Configuration
const PIXELA_API_BASE = 'https://pixe.la/v1';
const ACTIVITIES = {
    meditation: { name: 'Meditation', emoji: '🧘', graphId: 'meditation-graph' },
    sports: { name: 'Sports', emoji: '🏃', graphId: 'sports-graph' },
    dancing: { name: 'Dancing', emoji: '💃', graphId: 'dance-graph' },
    gaming: { name: 'Gaming', emoji: '🎮', graphId: 'gaming-graph' },
    freshair: { name: 'Fresh Air', emoji: '🌳', graphId: 'freshair-graph' },
    sauna: { name: 'Sauna', emoji: '🧖', graphId: 'sauna-graph' }
};

// State
let username = '';
let token = '';
let selectedDate = new Date();
let trackedActivities = new Set();

// DOM Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const saveSettingsBtn = document.getElementById('save-settings');
const usernameInput = document.getElementById('username');
const tokenInput = document.getElementById('token');
const rememberSettingsCheckbox = document.getElementById('remember-settings');
const trackDateInput = document.getElementById('track-date');
const todayBtn = document.getElementById('today-btn');
const activityButtons = document.querySelectorAll('.activity-btn');
const statusDiv = document.getElementById('status');

// Initialize
function init() {
    loadSettings();
    setDateToToday();
    setupEventListeners();

    if (!username || !token) {
        showSettings();
    } else {
        loadTodaysActivities();
    }
}

// Load settings from localStorage
function loadSettings() {
    const savedUsername = localStorage.getItem('pixela_username');
    const savedToken = localStorage.getItem('pixela_token');

    if (savedUsername && savedToken) {
        username = savedUsername;
        token = savedToken;
        usernameInput.value = username;
        tokenInput.value = token;
        rememberSettingsCheckbox.checked = true;
    }
}

// Save settings to localStorage
function saveSettings() {
    username = usernameInput.value.trim();
    token = tokenInput.value.trim();

    if (!username || !token) {
        showStatus('Please enter both username and token', 'error');
        return;
    }

    if (rememberSettingsCheckbox.checked) {
        localStorage.setItem('pixela_username', username);
        localStorage.setItem('pixela_token', token);
    } else {
        localStorage.removeItem('pixela_username');
        localStorage.removeItem('pixela_token');
    }

    hideSettings();
    showStatus('Settings saved successfully!', 'success');
    loadTodaysActivities();
    if (!document.getElementById('tab-graphs').classList.contains('hidden')) renderGraphs();
}

// Set date input to today
function setDateToToday() {
    const today = new Date();
    selectedDate = today;
    trackDateInput.valueAsDate = today;
}

// Setup event listeners
function setupEventListeners() {
    settingsBtn.addEventListener('click', showSettings);
    closeSettingsBtn.addEventListener('click', hideSettings);
    saveSettingsBtn.addEventListener('click', saveSettings);
    todayBtn.addEventListener('click', setDateToToday);
    trackDateInput.addEventListener('change', (e) => {
        selectedDate = e.target.valueAsDate || new Date();
        loadTodaysActivities();
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    activityButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const activity = btn.dataset.activity;
            trackActivity(activity);
        });
    });

    // Close modal when clicking outside
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            hideSettings();
        }
    });
}

// Show/hide settings modal
function showSettings() {
    settingsModal.classList.remove('hidden');
}

function hideSettings() {
    settingsModal.classList.add('hidden');
}

// Show status message
function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');

    setTimeout(() => {
        statusDiv.classList.add('hidden');
    }, 3000);
}

// Format date for Pixela API (YYYYMMDD)
function formatDateForPixela(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('hidden', panel.id !== `tab-${tabName}`);
    });
    if (tabName === 'graphs') renderGraphs();
}

// Render graphs from Pixe.la
function renderGraphs() {
    const container = document.getElementById('graphs-container');
    if (!username || !token) {
        container.innerHTML = '<p class="graphs-empty">Please configure your settings first.</p>';
        return;
    }
    container.innerHTML = Object.entries(ACTIVITIES).map(([, activity]) => `
        <div class="graph-card">
            <div class="graph-card-header">${activity.emoji} ${activity.name}</div>
            <img
                src="${PIXELA_API_BASE}/users/${username}/graphs/${activity.graphId}"
                alt="${activity.name} graph"
                loading="lazy"
            >
        </div>
    `).join('');
}

// Fetch with retry on network errors and server errors (5xx)
async function fetchWithRetry(url, options, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (response.status < 500 || attempt === maxRetries) return response;
        } catch (error) {
            if (attempt === maxRetries) throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Track activity
async function trackActivity(activityKey) {
    if (!username || !token) {
        showStatus('Please configure settings first', 'error');
        showSettings();
        return;
    }

    const activity = ACTIVITIES[activityKey];
    const dateStr = formatDateForPixela(selectedDate);

    try {
        showStatus(`Tracking ${activity.name}...`, 'info');

        const response = await fetchWithRetry(
            `${PIXELA_API_BASE}/users/${username}/graphs/${activity.graphId}`,
            {
                method: 'POST',
                headers: {
                    'X-USER-TOKEN': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    date: dateStr,
                    quantity: '1'
                })
            }
        );

        const result = await response.json();

        if (response.ok && result.isSuccess) {
            trackedActivities.add(activityKey);
            updateActivityButton(activityKey, true);
            showStatus(`${activity.emoji} ${activity.name} tracked!`, 'success');
        } else {
            throw new Error(result.message || 'Failed to track activity');
        }
    } catch (error) {
        console.error('Error tracking activity:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Update activity button appearance
function updateActivityButton(activityKey, tracked) {
    const button = document.querySelector(`[data-activity="${activityKey}"]`);
    if (button) {
        if (tracked) {
            button.classList.add('tracked');
        } else {
            button.classList.remove('tracked');
        }
    }
}

// Load today's activities from Pixela
async function loadTodaysActivities() {
    if (!username || !token) return;

    trackedActivities.clear();
    const dateStr = formatDateForPixela(selectedDate);

    for (const [key, activity] of Object.entries(ACTIVITIES)) {
        try {
            const response = await fetchWithRetry(
                `${PIXELA_API_BASE}/users/${username}/graphs/${activity.graphId}/${dateStr}`,
                {
                    headers: {
                        'X-USER-TOKEN': token
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.quantity && parseInt(data.quantity) > 0) {
                    trackedActivities.add(key);
                    updateActivityButton(key, true);
                } else {
                    updateActivityButton(key, false);
                }
            } else {
                updateActivityButton(key, false);
            }
        } catch (error) {
            console.error(`Error loading ${activity.name}:`, error);
            updateActivityButton(key, false);
        }
    }
}

// Start the app
init();
