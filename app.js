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
const activityLog = document.getElementById('activity-log');

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

        const response = await fetch(
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
            updateActivityLog();
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
            const response = await fetch(
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

    updateActivityLog();
}

// Update activity log display
function updateActivityLog() {
    activityLog.innerHTML = '';

    if (trackedActivities.size === 0) {
        activityLog.innerHTML = '<p style="color: #999;">No activities tracked yet for this date.</p>';
        return;
    }

    trackedActivities.forEach(key => {
        const activity = ACTIVITIES[key];
        const logItem = document.createElement('div');
        logItem.className = 'log-item';
        logItem.textContent = `${activity.emoji} ${activity.name}`;
        activityLog.appendChild(logItem);
    });
}

// Start the app
init();
