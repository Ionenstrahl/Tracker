// Configuration
const PIXELA_API_BASE = 'https://pixe.la/v1';
const GRAPH_PERIOD_DAYS = 365;
const ACTIVITY_COLORS = {
    meditation: '#0f766e',
    sports: '#dc2626',
    dancing: '#db2777',
    gaming: '#2563eb',
    freshair: '#16a34a',
    sauna: '#ea580c'
};
const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
});
const ACTIVITIES = {
    meditation: { name: 'Meditation', emoji: '🧘', graphId: 'meditation-graph' },
    sports: { name: 'Sports', emoji: '🏃', graphId: 'sports-graph' },
    dancing: { name: 'Dancing', emoji: '💃', graphId: 'dance-graph' },
    gaming: { name: 'Gaming', emoji: '🎮', graphId: 'gaming-graph' },
    freshair: { name: 'Fresh Air', emoji: '🌳', graphId: 'freshair-graph' },
    sauna: { name: 'Sauna', emoji: '🧖', graphId: 'sauna-graph' }
};

const darkModeMediaQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

// State
let username = '';
let token = '';
let selectedDate = new Date();
let trackedActivities = new Set();
let graphRenderSequence = 0;

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
    syncThemeMode();
    setupEventListeners();
    updateSelectedDate(new Date(), { refresh: Boolean(username && token) });

    if (!username || !token) {
        showSettings();
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
    refreshCurrentViews();
}

// Set date input to today
function setDateToToday() {
    updateSelectedDate(new Date());
}

// Setup event listeners
function setupEventListeners() {
    settingsBtn.addEventListener('click', showSettings);
    closeSettingsBtn.addEventListener('click', hideSettings);
    saveSettingsBtn.addEventListener('click', saveSettings);
    todayBtn.addEventListener('click', setDateToToday);
    trackDateInput.addEventListener('change', (e) => {
        updateSelectedDate(parseDateInputValue(e.target.value) || new Date());
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

    if (darkModeMediaQuery) {
        if (typeof darkModeMediaQuery.addEventListener === 'function') {
            darkModeMediaQuery.addEventListener('change', syncThemeMode);
        } else if (typeof darkModeMediaQuery.addListener === 'function') {
            darkModeMediaQuery.addListener(syncThemeMode);
        }
    }
}

// Show/hide settings modal
function showSettings() {
    settingsModal.classList.remove('hidden');
}

function hideSettings() {
    settingsModal.classList.add('hidden');
}

function detectAutoDarkMode() {
    if (!document.body) return false;

    // Force a light-only probe so Android auto-darking can still be detected.
    const probe = document.createElement('div');
    probe.style.display = 'none';
    probe.style.backgroundColor = 'canvas';
    probe.style.colorScheme = 'light';
    document.body.appendChild(probe);

    const computedBackground = window.getComputedStyle(probe).backgroundColor;
    probe.remove();

    return computedBackground !== 'rgb(255, 255, 255)';
}

function syncThemeMode() {
    const prefersDarkMode = Boolean(darkModeMediaQuery && darkModeMediaQuery.matches);
    const isDarkMode = prefersDarkMode || detectAutoDarkMode();
    document.documentElement.classList.toggle('dark-mode', isDarkMode);
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

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDateInputValue(value) {
    if (!value) return null;
    const parts = value.split('-').map(Number);
    if (parts.length !== 3 || parts.some(part => Number.isNaN(part))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function atStartOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
    const nextDate = atStartOfDay(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
}

function getStartOfWeek(date) {
    const start = atStartOfDay(date);
    const dayOfWeek = start.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setDate(start.getDate() + mondayOffset);
    return start;
}

function isGraphsTabVisible() {
    return !document.getElementById('tab-graphs').classList.contains('hidden');
}

function refreshCurrentViews() {
    loadTodaysActivities();
    if (isGraphsTabVisible()) {
        renderGraphs();
    }
}

function updateSelectedDate(date, { refresh = true } = {}) {
    selectedDate = atStartOfDay(date);
    trackDateInput.value = formatDateForInput(selectedDate);

    if (refresh) {
        refreshCurrentViews();
    }
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

function getGraphDisplayWindow(anchorDate) {
    const rangeEnd = atStartOfDay(anchorDate);
    const rangeStart = addDays(rangeEnd, -(GRAPH_PERIOD_DAYS - 1));
    const displayStart = getStartOfWeek(rangeStart);
    const daysUntilSunday = rangeEnd.getDay() === 0 ? 0 : 7 - rangeEnd.getDay();
    const displayEnd = addDays(rangeEnd, daysUntilSunday);

    return { rangeStart, rangeEnd, displayStart, displayEnd };
}

function formatDisplayDate(date) {
    return DATE_LABEL_FORMATTER.format(date);
}

function buildGraphDays(displayStart, displayEnd, rangeStart, rangeEnd, trackedDates) {
    const days = [];

    for (let currentDate = atStartOfDay(displayStart); currentDate <= displayEnd; currentDate = addDays(currentDate, 1)) {
        const dateStr = formatDateForPixela(currentDate);
        const inRange = currentDate >= rangeStart && currentDate <= rangeEnd;

        days.push({
            date: atStartOfDay(currentDate),
            dateStr,
            inRange,
            tracked: inRange && trackedDates.has(dateStr)
        });
    }

    return days;
}

function renderBooleanGraph(days, activityKey) {
    const weekCount = Math.ceil(days.length / 7);

    return `
        <div
            class="boolean-graph"
            style="--activity-color: ${ACTIVITY_COLORS[activityKey] || '#667eea'}; --week-count: ${weekCount};"
        >
            <div class="boolean-graph-grid">
                ${days.map((day) => {
                    const cellClass = day.inRange
                        ? (day.tracked ? 'is-tracked' : 'is-empty')
                        : 'is-outside';
                    const monthClass = day.date.getMonth() % 2 === 1 ? 'is-alt-month' : '';
                    const statusLabel = day.inRange
                        ? (day.tracked ? 'Tracked' : 'Not tracked')
                        : 'Outside selected range';

                    return `
                        <span
                            class="boolean-graph-cell ${cellClass} ${monthClass}"
                            title="${formatDisplayDate(day.date)}: ${statusLabel}"
                            aria-label="${formatDisplayDate(day.date)}: ${statusLabel}"
                        ></span>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

async function fetchGraphPixels(graphId, fromDate, toDate) {
    const params = new URLSearchParams({
        from: formatDateForPixela(fromDate),
        to: formatDateForPixela(toDate),
        withBody: 'true'
    });
    const response = await fetchWithRetry(
        `${PIXELA_API_BASE}/users/${username}/graphs/${graphId}/pixels?${params.toString()}`,
        {
            headers: {
                'X-USER-TOKEN': token
            }
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || 'Failed to load graph history');
    }

    return Array.isArray(data.pixels) ? data.pixels : [];
}

function renderGraphCard(activityKey, activity, days, trackedCount) {
    return `
        <div class="graph-card">
            <div class="graph-card-header">
                <span>${activity.emoji} ${activity.name}</span>
                <span class="graph-card-summary">${trackedCount} days</span>
            </div>
            ${renderBooleanGraph(days, activityKey)}
        </div>
    `;
}

function renderGraphErrorCard(activity) {
    return `
        <div class="graph-card">
            <div class="graph-card-header">
                <span>${activity.emoji} ${activity.name}</span>
            </div>
            <div class="graph-error">Could not load this graph.</div>
        </div>
    `;
}

// Render graphs from Pixe.la
async function renderGraphs() {
    const container = document.getElementById('graphs-container');
    if (!username || !token) {
        container.innerHTML = '<p class="graphs-empty">Please configure your settings first.</p>';
        return;
    }

    const renderId = ++graphRenderSequence;
    const { rangeStart, rangeEnd, displayStart, displayEnd } = getGraphDisplayWindow(selectedDate);

    container.innerHTML = '<p class="graphs-loading">Loading graphs...</p>';

    const graphCards = await Promise.all(
        Object.entries(ACTIVITIES).map(async ([activityKey, activity]) => {
            try {
                const pixels = await fetchGraphPixels(activity.graphId, rangeStart, rangeEnd);
                const trackedDates = new Set(
                    pixels
                        .filter(pixel => Number.parseFloat(pixel.quantity) > 0)
                        .map(pixel => pixel.date)
                );
                const days = buildGraphDays(displayStart, displayEnd, rangeStart, rangeEnd, trackedDates);
                return renderGraphCard(activityKey, activity, days, trackedDates.size);
            } catch (error) {
                console.error(`Error loading graph ${activity.name}:`, error);
                return renderGraphErrorCard(activity);
            }
        })
    );

    if (renderId !== graphRenderSequence) {
        return;
    }

    container.innerHTML = graphCards.join('');
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
            if (isGraphsTabVisible()) {
                renderGraphs();
            }
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
