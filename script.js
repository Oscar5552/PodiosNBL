// --- ESTADO INICIAL ---
let deckState = [
    { type: 'std', blade: null, ratchet: null, bit: null, cxParts: { chip: null, main: null, assist: null } },
    { type: 'std', blade: null, ratchet: null, bit: null, cxParts: { chip: null, main: null, assist: null } },
    { type: 'std', blade: null, ratchet: null, bit: null, cxParts: { chip: null, main: null, assist: null } }
];

let currentEdit = { index: 0, partType: '' };
let currentBladeTab = 'std';
let currentListItems = []; // Lista actual para el buscador
let currentSearchCallback = null; // Callback actual al hacer click

// Cargar DB generada por PowerShell
const db = (typeof partsData !== 'undefined') ? partsData : {};

document.addEventListener('DOMContentLoaded', () => {
    resizeCard();
    renderDeck();
});

// --- HELPERS (RUTAS SEGURAS) ---
function getImgSrc(path, variant) {
    if (!path || !variant) return '';
    let cleanPath = path.replace(/\\/g, '/'); // Asegurar slash normal
    // Codificar partes para soportar espacios y caracteres especiales
    let parts = cleanPath.split('/').map(p => encodeURIComponent(p)).join('/');
    let file = encodeURIComponent(variant);
    return `${parts}/${file}`;
}

function cleanDisplayName(name) {
    if (!name) return "";
    if (name.includes('_')) {
        const parts = name.split('_');
        return parts[parts.length - 1]; // Tomar última parte tras guión bajo
    }
    return name;
}

// --- LAYOUT ---
function resizeCard() {
    const card = document.getElementById('tournament-card');
    const wrapper = document.getElementById('scale-wrapper');
    const originalSize = 1080; // Tamaño base de la tarjeta

    // Obtener dimensiones actuales de la ventana
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let scale = 1;

    // --- LÓGICA DIFERENTE SEGÚN EL MODO ---
    if (document.body.classList.contains('photo-mode')) {
        // === MODO FOTO ===
        // El objetivo es que la tarjeta SE VEA COMPLETA en la pantalla.

        if (windowWidth <= 768) {
            // MÓVIL: Calculamos la escala para que el ANCHO de la tarjeta (1080)
            // quepa exactamente en el ANCHO de la pantalla del celular.
            scale = windowWidth / originalSize;
        } else {
            // ESCRITORIO: Calculamos la escala para que quepa tanto en ancho como en alto,
            // dejando un pequeño margen (50px) para que no se pegue a los bordes.
            const margin = 50;
            const scaleX = (windowWidth - margin) / originalSize;
            const scaleY = (windowHeight - margin) / originalSize;
            // Usamos el menor factor de escala para asegurar que nada se corte
            scale = Math.min(scaleX, scaleY, 1);
        }

    } else {
        // === MODO EDICIÓN (Normal) ===
        // El objetivo es que sea cómodo de editar.

        // En móvil usamos márgen 0 para aprovechar todo el ancho. En PC, un margen de 40px.
        const margin = windowWidth < 768 ? 0 : 40;
        scale = (windowWidth - margin) / originalSize;
        // Limitamos a escala 1 para que no se pixelee en pantallas gigantes
        if (scale > 1) scale = 1;
    }

    // --- APLICAR LA ESCALA CALCULADA ---
    card.style.transform = `scale(${scale})`;

    // --- AJUSTAR EL CONTENEDOR (Wrapper) ---
    if (document.body.classList.contains('photo-mode') && windowWidth <= 768) {
        // En MODO FOTO MÓVIL, el wrapper no debe tener tamaño fijo.
        // El CSS del body (flexbox) se encargará de centrar la tarjeta escalada.
        wrapper.style.width = 'auto';
        wrapper.style.height = 'auto';
    } else {
        // EN TODOS LOS DEMÁS CASOS, el wrapper debe tener el tamaño exacto 
        // que ocupa la tarjeta escalada para mantener el flujo de la página.
        const newSize = originalSize * scale;
        wrapper.style.width = `${newSize}px`;
        wrapper.style.height = `${newSize}px`;
    }
}

// Aseguramos que se ejecute al cargar y al rotar el celular
window.addEventListener('resize', resizeCard);
window.addEventListener('orientationchange', () => {
    setTimeout(resizeCard, 100); // Pequeño delay para que el navegador recalcule el ancho
});
window.addEventListener('resize', resizeCard);

// Inputs y Carga de Fotos
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

    // Modo Compacto (Sube la caja si hay 4+ combos)
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
            // Nombre Combinado: Chip Main Assist
            const nChip = cleanDisplayName(combo.cxParts.chip.name);
            const nMain = cleanDisplayName(combo.cxParts.main ? combo.cxParts.main.name : '');
            const nAssist = cleanDisplayName(combo.cxParts.assist ? combo.cxParts.assist.name : '');
            bladeName = `${nChip} ${nMain} ${nAssist}`.trim();

            const srcMain = combo.cxParts.main ? getImgSrc(combo.cxParts.main.path, combo.cxParts.main.variants[0]) : '';
            const srcAssist = combo.cxParts.assist ? getImgSrc(combo.cxParts.assist.path, combo.cxParts.assist.variants[0]) : '';
            const srcChip = getImgSrc(combo.cxParts.chip.path, combo.cxParts.chip.variants[0]);

            // Estructura HTML para superposición CSS
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

        // Ratchets y Bits
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

// --- BUSCADOR ---
function filterItems() {
    const query = document.getElementById('search-box').value.toLowerCase();
    const filtered = currentListItems.filter(item => {
        const n = cleanDisplayName(item.name).toLowerCase();
        return n.includes(query);
    });
    // Renderizamos filtrado PERO mantenemos el callback actual
    renderList(filtered, currentSearchCallback, false);
}

// --- MODAL ---
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
function formatName(name) { if (name.includes('_')) return name.split('_').pop(); return name; }

/* Reemplaza tu función togglePhotoMode con esta */
function togglePhotoMode() {
    document.body.classList.toggle('photo-mode');
    const card = document.getElementById('tournament-card');
    const wrapper = document.getElementById('scale-wrapper');

    if (document.body.classList.contains('photo-mode')) {
        // --- CORRECCIÓN PARA MÓVIL ---
        // Si la pantalla es pequeña (celular), calculamos el zoom para que quepa
        if (window.innerWidth < 1080) {
            const scale = window.innerWidth / 1080; // Ajuste exacto al ancho
            card.style.transform = `scale(${scale})`;
            
            // Ajustamos el wrapper para que no ocupe espacio extra innecesario
            wrapper.style.width = `${1080 * scale}px`;
            wrapper.style.height = `${1080 * scale}px`;
        } else {
            // En PC, dejamos el tamaño original (o un poco menos para que no se salga)
            card.style.transform = "scale(0.9)"; 
        }
    } else {
        // Al salir, volvemos al cálculo normal
        resizeCard();
    }
}
document.querySelector('.save-btn').onclick = togglePhotoMode;
document.addEventListener('keydown', (e) => { if (e.key === "Escape" && document.body.classList.contains('photo-mode')) togglePhotoMode(); });
document.addEventListener('DOMContentLoaded', () => {
    // 1. Configurar el botón de "Salir del Modo Foto"
    const exitBtn = document.getElementById('exit-photo-mode');
    if (exitBtn) {
        exitBtn.addEventListener('click', () => {
            // Quitar la clase del body
            document.body.classList.remove('photo-mode');
            // IMPORTANTE: Recalcular la escala para volver al tamaño de edición
            resizeCard();
        });
    }

    // 2. Configurar el botón de "Entrar al Modo Foto"
    const photoModeBtn = document.getElementById('btn-photo-mode');
    if (photoModeBtn) {
        // Un truco para limpiar listeners viejos y evitar que se ejecute varias veces
        const newBtn = photoModeBtn.cloneNode(true);
        photoModeBtn.parentNode.replaceChild(newBtn, photoModeBtn);

        newBtn.addEventListener('click', () => {
            // Agregar la clase al body
            document.body.classList.add('photo-mode');
            // IMPORTANTE: Recalcular la escala para ajustar la vista a la pantalla
            resizeCard();

            // (Aquí iría tu código para tomar la captura con html2canvas si lo tuvieras)
            // Por ejemplo: setTimeout(() => takeScreenshot(), 500);
        });
    }

    // Asegurar que la escala inicial sea correcta
    resizeCard();
});