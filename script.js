// --- ESTADO INICIAL ---
let deckState = [
    { type: 'std', blade: null, ratchet: null, bit: null, cxParts: { chip: null, main: null, assist: null } },
    { type: 'std', blade: null, ratchet: null, bit: null, cxParts: { chip: null, main: null, assist: null } },
    { type: 'std', blade: null, ratchet: null, bit: null, cxParts: { chip: null, main: null, assist: null } }
];

let currentEdit = { index: 0, partType: '' };
let currentBladeTab = 'std';
let currentListItems = []; 
let currentSearchCallback = null; 

// Cargar DB
const db = (typeof partsData !== 'undefined') ? partsData : {};

document.addEventListener('DOMContentLoaded', () => {
    resizeCard();
    renderDeck();
    
    // Configurar botones modo foto
    const exitBtn = document.getElementById('exit-photo-mode');
    if (exitBtn) exitBtn.addEventListener('click', () => { document.body.classList.remove('photo-mode'); resizeCard(); });
});

// --- HELPERS (CORRECCIÓN DE RUTAS) ---
function getImgSrc(path, variant) {
    if (!path || !variant) return '';
    
    // 1. Normalizar barras (cambiar \ por /)
    let cleanPath = path.replace(/\\/g, '/');
    
    // 2. [CORRECCIÓN WEB] Si la ruta incluye "piezas", cortamos todo lo anterior
    // Esto arregla el error si se subió como "E:/trabajo/piezas/..."
    const index = cleanPath.toLowerCase().indexOf('piezas/');
    if (index !== -1) {
        cleanPath = cleanPath.substring(index);
    }

    // 3. Codificar para soportar espacios y caracteres especiales
    let parts = cleanPath.split('/').map(p => encodeURIComponent(p)).join('/');
    let file = encodeURIComponent(variant);
    
    return `${parts}/${file}`;
}

function cleanDisplayName(name) {
    if (!name) return "";
    if (name.includes('_')) {
        const parts = name.split('_');
        return parts[parts.length - 1]; 
    }
    return name;
}

// --- LAYOUT ---
function resizeCard() {
     if (document.body.classList.contains('photo-mode')) return; // No reescalar en modo foto móvil si ya está ajustado
     
     const card = document.getElementById('tournament-card');
     const wrapper = document.getElementById('scale-wrapper');
     const originalSize = 1080;
     const cardHeight = 1440;
     const windowWidth = window.innerWidth;
     
     // Margen automático
     const margin = windowWidth < 768 ? 0 : 40;
     let scale = (windowWidth - margin) / originalSize;
     if (scale > 1) scale = 1;

     card.style.transform = `scale(${scale})`;
     wrapper.style.width = `${originalSize * scale}px`;
     wrapper.style.height = `${cardHeight * scale}px`;
}
window.addEventListener('resize', resizeCard);
window.addEventListener('orientationchange', () => setTimeout(resizeCard, 100));

// Inputs
function triggerUpload(inputId) { document.getElementById(inputId).click(); }
function triggerDatePicker() { try { document.getElementById('date-input').showPicker(); } catch (e) { document.getElementById('date-input').click(); } }
function updateDateDisplay(input) { if (input.value) { const parts = input.value.split('-'); document.getElementById('date-text').innerText = `${parts[2]}.${parts[1]}.${parts[0]}`; } }
function syncRank(element) { document.getElementById('bg-rank-display').innerText = element.innerText; }

function loadImage(event, imgId, containerId, mode) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            if (mode === 'src') {
                document.getElementById(imgId).src = e.target.result;
            } else if (mode === 'container') {
                const container = document.getElementById(containerId);
                const placeholder = container.querySelector('.placeholder-text-fire');
                if (placeholder) placeholder.style.display = 'none';
                const existingImg = container.querySelector('img.player-img-fit');
                if (existingImg) existingImg.remove();
                const newImg = document.createElement('img');
                newImg.src = e.target.result;
                newImg.className = 'player-img-fit';
                container.appendChild(newImg);
            }
        };
        reader.readAsDataURL(file);
    }
}

// --- DECK BUILDER ---

function updateDeckSize(delta) {
    const newSize = deckState.length + delta;
    if (newSize < 1 || newSize > 5) return;
    if (delta > 0) deckState.push({ type: 'std', blade: null, ratchet: null, bit: null, cxParts: {} });
    else deckState.pop();
    document.getElementById('combo-count-display').innerText = newSize;
    renderDeck();
}

function renderDeck() {
    const container = document.getElementById('deck-list-container');
    const displayArea = document.querySelector('.beyblade-display-area');

    if (deckState.length >= 4) displayArea.classList.add('compact-mode');
    else displayArea.classList.remove('compact-mode');

    container.innerHTML = '';

    deckState.forEach((combo, index) => {
        const row = document.createElement('div');
        row.className = 'combo-row';

        let bladeHtml = '';
        let bladeName = "";

        // --- RENDERIZADO CX (STACK) ---
        if (combo.type === 'cx' && combo.cxParts.chip) {
            const nChip = cleanDisplayName(combo.cxParts.chip.name);
            const nMain = cleanDisplayName(combo.cxParts.main ? combo.cxParts.main.name : '');
            const nAssist = cleanDisplayName(combo.cxParts.assist ? combo.cxParts.assist.name : '');
            bladeName = `${nChip} ${nMain} ${nAssist}`.trim();

            const srcMain = combo.cxParts.main ? getImgSrc(combo.cxParts.main.path, combo.cxParts.main.variants[0]) : '';
            const srcAssist = combo.cxParts.assist ? getImgSrc(combo.cxParts.assist.path, combo.cxParts.assist.variants[0]) : '';
            const srcChip = getImgSrc(combo.cxParts.chip.path, combo.cxParts.chip.variants[0]);

            // Estructura de capas (Stack)
            bladeHtml = `
                ${srcAssist ? `<img src="${srcAssist}" class="cx-assist">` : ''}
                ${srcMain ? `<img src="${srcMain}" class="cx-main">` : ''}
                <img src="${srcChip}" class="cx-chip">
            `;

        } else if (combo.blade) {
            // STANDARD
            const srcBlade = getImgSrc(combo.blade.path, combo.blade.variants[0]);
            bladeHtml = `<img src="${srcBlade}" class="blade-normal-img">`;
            bladeName = cleanDisplayName(combo.blade.name);
        } else {
            bladeHtml = `<img src="https://placehold.co/150x150/222/444?text=?" style="opacity:0.3; object-fit:contain; width:100%; height:100%;">`;
            bladeName = "Blade";
        }

        const rImg = combo.ratchet ? `<img src="${getImgSrc(combo.ratchet.path, combo.ratchet.variants[0])}">` : '?';
        const bImg = combo.bit ? `<img src="${getImgSrc(combo.bit.path, combo.bit.variants[0])}">` : '?';

        const rName = combo.ratchet ? cleanDisplayName(combo.ratchet.name) : "Ratchet";
        const bName = combo.bit ? cleanDisplayName(combo.bit.name) : "Bit";

        row.innerHTML = `
            <div class="slot-group">
                <div class="bey-image-container" onclick="openModal(${index}, 'blade')">
                    ${bladeHtml}
                </div>
                <div class="part-label">${bladeName}</div>
            </div>

            <div class="bey-parts-row">
                <div class="slot-group">
                    <div class="slot-icon" onclick="openModal(${index}, 'ratchet')">${rImg}</div>
                    <div class="part-label">${rName}</div>
                </div>

                <div class="slot-group">
                    <div class="slot-icon bit-slot" onclick="openModal(${index}, 'bit')">${bImg}</div>
                    <div class="part-label">${bName}</div>
                </div>
            </div>
        `;
        container.appendChild(row);
    });
}

// --- MODAL & BUSCADOR ---
function filterItems() {
    const query = document.getElementById('search-box').value.toLowerCase();
    const filtered = currentListItems.filter(item => {
        const n = cleanDisplayName(item.name).toLowerCase();
        return n.includes(query);
    });
    renderList(filtered, currentSearchCallback, false);
}

function openModal(index, partType) {
    currentEdit = { index, partType };
    const modal = document.getElementById('modal');
    const tabs = document.getElementById('blade-tabs');
    document.getElementById('search-box').value = '';

    modal.classList.remove('hidden');

    if (partType === 'blade') {
        tabs.classList.remove('hidden');
        switchTab(currentBladeTab);
    } else {
        tabs.classList.add('hidden');
        const items = (partType === 'ratchet') ? db.ratchets : db.bits;
        currentListItems = items;
        currentSearchCallback = (selected) => {
            const combo = deckState[currentEdit.index];
            if (partType === 'ratchet') combo.ratchet = selected;
            if (partType === 'bit') combo.bit = selected;
            closeModal();
            renderDeck();
        };
        renderList(items, currentSearchCallback);
    }
}

function switchTab(tab) {
    currentBladeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        if (b.textContent.includes(tab === 'std' ? 'STANDARD' : 'CX')) b.classList.add('active');
    });
    document.getElementById('search-box').value = '';

    if (tab === 'std') {
        currentListItems = db.blades;
        currentSearchCallback = (selected) => {
            const combo = deckState[currentEdit.index];
            combo.type = 'std';
            combo.blade = selected;
            combo.cxParts = {};
            closeModal();
            renderDeck();
        };
        renderList(db.blades, currentSearchCallback);
    } else {
        renderCXStep1();
    }
}

function renderCXStep1() {
    const grid = document.getElementById('modal-grid');
    grid.innerHTML = '<h4 style="grid-column:1/-1; color:white; text-align:center;">PASO 1: CHIP</h4>';
    currentListItems = db.cx_chips;
    currentSearchCallback = (chip) => renderCXStep2(chip);
    renderList(db.cx_chips, currentSearchCallback, false);
}

function renderCXStep2(chip) {
    const grid = document.getElementById('modal-grid');
    grid.innerHTML = '<h4 style="grid-column:1/-1; color:white; text-align:center;">PASO 2: MAIN BLADE</h4>';
    document.getElementById('search-box').value = '';
    currentListItems = db.cx_main_blades;
    currentSearchCallback = (main) => renderCXStep3(chip, main);
    renderList(db.cx_main_blades, currentSearchCallback, false);
}

function renderCXStep3(chip, main) {
    const grid = document.getElementById('modal-grid');
    grid.innerHTML = '<h4 style="grid-column:1/-1; color:white; text-align:center;">PASO 3: ASSIST</h4>';
    document.getElementById('search-box').value = '';
    currentListItems = db.cx_assists;
    currentSearchCallback = (assist) => {
        const combo = deckState[currentEdit.index];
        combo.type = 'cx';
        combo.blade = null;
        combo.cxParts = { chip, main, assist };
        closeModal();
        renderDeck();
    };
    renderList(db.cx_assists, currentSearchCallback, false);
}

function renderList(items, onSelectFinal, clearGrid = true) {
    const grid = document.getElementById('modal-grid');
    if (clearGrid) {
        if (currentEdit.partType !== 'blade' || currentBladeTab === 'std') grid.innerHTML = '';
    } else {
        const oldItems = grid.querySelectorAll('.item-card');
        oldItems.forEach(el => el.remove());
    }

    if (!items || items.length === 0) return;

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'item-card';
        const src = (item.variants && item.variants.length > 0) ? getImgSrc(item.path, item.variants[0]) : '';

        el.innerHTML = `
            <img src="${src}" loading="lazy">
            <span class="item-name">${cleanDisplayName(item.name)}</span>
        `;
        el.onclick = () => showVariants(item, onSelectFinal);
        grid.appendChild(el);
    });
}

function showVariants(item, onSelectFinal) {
    const grid = document.getElementById('modal-grid');
    grid.innerHTML = '';
    const backBtn = document.createElement('button');
    backBtn.innerText = "VOLVER"; backBtn.className = "item-card"; backBtn.style.gridColumn = "1/-1";
    backBtn.onclick = () => {
        if (currentEdit.partType === 'blade') {
            if (currentBladeTab === 'std') switchTab('std'); else renderCXStep1();
        } else openModal(currentEdit.index, currentEdit.partType);
    };
    grid.appendChild(backBtn);

    item.variants.forEach(v => {
        const el = document.createElement('div');
        el.className = 'item-card';
        const src = getImgSrc(item.path, v);
        const vName = v.replace('.png', '');
        el.innerHTML = `<img src="${src}" loading="lazy"><span class="item-name">${vName}</span>`;
        el.onclick = () => onSelectFinal({ name: item.name, path: item.path, variants: [v] });
        grid.appendChild(el);
    });
}

function closeModal() { document.getElementById('modal').classList.add('hidden'); }

// --- MODO FOTO ---
function togglePhotoMode() {
     document.body.classList.toggle('photo-mode');
     const card = document.getElementById('tournament-card');
     const wrapper = document.getElementById('scale-wrapper');

     if (document.body.classList.contains('photo-mode')) {
         // En modo foto: escalar para que quepa en la pantalla
         const scale = window.innerWidth < 1080 ? window.innerWidth / 1080 : 0.9;
         card.style.transform = `scale(${scale})`;
         
         if (window.innerWidth < 1080) {
             wrapper.style.width = `${1080 * scale}px`;
             wrapper.style.height = `${1440 * scale}px`;
         }
     } else {
         resizeCard();
     }
}
document.querySelector('.save-btn').onclick = togglePhotoMode;
document.addEventListener('keydown', (e) => { if (e.key === "Escape" && document.body.classList.contains('photo-mode')) togglePhotoMode(); });