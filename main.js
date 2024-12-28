// main.js
const CLIENT_ID = CONFIG.CLIENT_ID;
const API_KEY = CONFIG.API_KEY;
const DISCOVERY_DOC = CONFIG.DISCOVERY_DOC;
const SCOPES = CONFIG.SCOPES;
const DOC_ID = CONFIG.DOC_ID;

let tokenClient;
let gapiInited = false;
let gisInited = false;

window.gapiLoaded = () => {
    gapi.load('client', initializeGapiClient);
};

window.gisLoaded = () => {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: handleAuthResponse,
    });
    gisInited = true;
    maybeEnableButtons();
};

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        maybeEnableButtons();
    } catch (err) {
        console.error(err);
    }
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById(CONFIG.DOM_IDS.LOGIN_BUTTON).disabled = false;
    }
}

async function handleAuthResponse(response) {
    if (response.error !== undefined) {
        return;
    }
    try {
        await loadGroceryList();
        document.getElementById(CONFIG.DOM_IDS.LOGIN_SECTION).classList.add('hidden');
        document.getElementById(CONFIG.DOM_IDS.GROCERY_SECTION).classList.remove('hidden');
    } catch (err) {
        console.error(err);
    }
}

function handleAuthClick() {
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

let containerItems = [];
let absoluteItems = [];

async function loadGroceryList() {
    try {
        const response = await gapi.client.drive.files.export({
            fileId: DOC_ID,
            mimeType: 'text/plain'
        });

        console.log("Raw response:", response);

        if (!response || !response.body) {
            throw new Error('No content received from document');
        }

        const content = response.body;
        console.log("Content:", content);

        const lines = content.split('\n').map(line => line.trim()).filter(Boolean);

        const absoluteSectionStart = lines.findIndex(line =>
            line.includes(CONFIG.SECTIONS.ABSOLUTE_MARKER));

        const firstWeeklyItem = lines.findIndex((line, index) =>
            index > absoluteSectionStart + 2 &&
            line.match(/^\d+:/) &&
            !lines[index - 1].includes('absolutely want')
        );

        if (absoluteSectionStart !== -1 && firstWeeklyItem !== -1) {
            absoluteItems = lines
                .slice(absoluteSectionStart + 1, firstWeeklyItem)
                .filter(line => line.match(/^\d+:/))
                .map(line => line.split(':')[1].trim())
                .filter(Boolean);
        }

        const containerSectionStart = lines.findIndex(line => line === CONFIG.SECTIONS.CONTAINER_MARKER);
        if (containerSectionStart !== -1) {
            containerItems = lines
                .slice(containerSectionStart + 2)
                .filter(line => line.match(/^\d+:/))
                .map(line => line.split(':')[1].trim())
                .filter(Boolean);
        }

        console.log("Parsed regular items:", containerItems);
        console.log("Parsed absolute items:", absoluteItems);

        if (containerItems.length === 0 && absoluteItems.length === 0) {
            throw new Error('No items found in document');
        }

        generateNewList();
    } catch (err) {
        console.error('Detailed error:', err);
        document.getElementById(CONFIG.DOM_IDS.WEEKLY_ITEMS).innerHTML = `Error: ${err.message}`;
        document.getElementById(CONFIG.DOM_IDS.ABSOLUTE_ITEMS).innerHTML = `Error: ${err.message}`;
    }
}

function generateNewList() {
    const absoluteItemsElement = document.getElementById(CONFIG.DOM_IDS.ABSOLUTE_ITEMS);
    if (absoluteItems.length === 0) {
        absoluteItemsElement.innerHTML = 'No must-have items';
    } else {
        absoluteItemsElement.innerHTML = absoluteItems.map((item, index) => `${index + 1}: ${item}`).join('\n');
    }

    const weeklyItems = document.getElementById(CONFIG.DOM_IDS.WEEKLY_ITEMS);
    if (containerItems.length === 0) {
        weeklyItems.innerHTML = 'No items available';
        return;
    }

    const shuffled = [...containerItems].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 5);

    weeklyItems.innerHTML = selected.map((item, index) => `${index + 1}: ${item}`).join('\n');
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById(CONFIG.DOM_IDS.LOGIN_BUTTON).addEventListener('click', handleAuthClick);
    document.getElementById('regenerateButton').addEventListener('click', generateNewList);

    document.querySelectorAll('.copy-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const sourceId = e.currentTarget.dataset.source;
            const text = document.getElementById(sourceId).innerText;
            navigator.clipboard.writeText(text).catch(err => {
                console.error('Failed to copy text:', err);
            });
        });
    });
});