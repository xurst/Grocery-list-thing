// main.js
const CLIENT_ID = '855325079958-hl4gqsg23q6sk0nbu4sunpun5d3ltkp1.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBhsojdbofAzq_v3dxZrgqfj4521zpuqRE';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';
const DOC_ID = '11NS1eX7fUaSEqOJpTsfWBOVaYfpWEP32ITCJy9HDUqI';

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
        document.getElementById('loginButton').disabled = false;
    }
}

async function handleAuthResponse(response) {
    if (response.error !== undefined) {
        return;
    }
    try {
        await loadGroceryList();
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('grocerySection').classList.remove('hidden');
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
            line.includes('(items that i absolutely want)'));

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

        const containerSectionStart = lines.findIndex(line => line === 'Container');
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
        document.getElementById('weeklyItems').innerHTML = `Error: ${err.message}`;
        document.getElementById('absoluteItems').innerHTML = `Error: ${err.message}`;
    }
}

function generateNewList() {
    const absoluteItemsElement = document.getElementById('absoluteItems');
    if (absoluteItems.length === 0) {
        absoluteItemsElement.innerHTML = 'No must-have items';
    } else {
        absoluteItemsElement.innerHTML = absoluteItems.map((item, index) => `${index + 1}: ${item}`).join('\n');
    }

    const weeklyItems = document.getElementById('weeklyItems');
    if (containerItems.length === 0) {
        weeklyItems.innerHTML = 'No items available';
        return;
    }

    const shuffled = [...containerItems].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 5);

    weeklyItems.innerHTML = selected.map((item, index) => `${index + 1}: ${item}`).join('\n');
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginButton').addEventListener('click', handleAuthClick);
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