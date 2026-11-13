// 1. Initiera kartan (startar över Japan tills waypoints/platser laddats)
const map = L.map('map').setView(L.latLng(36.2048, 138.2529), 5);

const tileUrl = ['https:/', 'tile.openstreetmap.org', '{z}', '{x}', '{y}.png'].join('/');
L.tileLayer(tileUrl, {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let platserData = new Array();
let waypointMode = false;
let waypointCounter = 1;
let waypointsState = new Array();
let routeLayers = new Array(); // Lagrar alla linjesegment på kartan

// Funktion som anpassar kartans utsnitt och inzoomning efter dina waypoints
function fitMapToWaypoints() {
    if (waypointsState.length === 0) return;

    if (waypointsState.length === 1) {
        const wp = waypointsState.at(0);
        map.setView(L.latLng(wp.lat, wp.Lon), 14);
    } else {
        const coords = waypointsState.map(wp => L.latLng(wp.lat, wp.Lon));
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, {
            padding: L.point(60, 60),
            maxZoom: 16
        });
    }
}

// 2. Hämta först platser.json, och därefter waypoints.json
fetch('platser.json')
    .then(response => {
        if (!response.ok) throw new Error('Kunde inte hämta platser.json');
        return response.json();
    })
    .then(data => {
        platserData = data;
        renderPlaces(platserData);
        loadSavedWaypoints();
    })
    .catch(err => {
        console.error('Fel vid laddning av platser.json:', err);
        loadSavedWaypoints();
    });

function loadSavedWaypoints() {
    fetch('waypoints.json')
        .then(response => {
            if (!response.ok) throw new Error('Ingen waypoints.json hittades');
            return response.json();
        })
        .then(data => {
            if (data && Array.isArray(data.waypoints)) {
                const globalColor = data.color || 'black';

                data.waypoints.forEach(item => {
                    const wp = item.waypoint || item;
                    if (wp.lat !== undefined && wp.Lon !== undefined) {
                        const matchedPlace = platserData.find(p => p.id === wp.id);
                        const mappedId = matchedPlace ? wp.id : "";
                        const wpId = `wp-${waypointCounter++}`;
                        const wpColor = wp.color || globalColor;

                        addWaypointToMap(wpId, Number(wp.lat), Number(wp.Lon), mappedId, wpColor);
                    }
                });
                updateWaypointUI();
                fitMapToWaypoints();
            }
        })
        .catch(err => {
            console.log('Ingen sparad waypoints.json hittades i mappen.');
        });
}

function renderPlaces(platser) {
    platser.forEach(plats => {
        const dotColor = plats.color || 'black';

        const btnIcon = L.divIcon({
            className: '',
            html: `
                <div class="place-marker-container">
                    <div class="place-dot" style="background-color: ${dotColor};"></div>
                    <span class="place-label">${plats.Namn}</span>
                </div>
            `,
            iconSize: null
        });

        const marker = L.marker(L.latLng(plats.plats.lat, plats.plats.Lon), { icon: btnIcon }).addTo(map);

        marker.on('click', () => {
            showPlaceDetails(plats);
            map.flyTo(L.latLng(plats.plats.lat, plats.plats.Lon), 15);
        });
    });
}

function showPlaceDetails(plats) {
    const panel = document.getElementById('info-panel');
    panel.innerHTML = `
        <h2>${plats.Namn}</h2>
        <p style="font-size: 12px; color: #777;">ID: ${plats.id}</p>
        ${plats.img ? `<img src="${plats.img}" alt="${plats.Namn}">` : ''}
        <p style="margin-top: 8px; line-height: 1.5;">${plats.beskrivning}</p>
        <p style="margin-top: 8px; font-size: 13px;">
            <strong>Koordinater:</strong> ${plats.plats.lat.toFixed(5)}, ${plats.plats.Lon.toFixed(5)}
        </p>
        <a href="${plats.googlemapLink}" target="_blank" class="btn">Öppna i Google Maps</a>
    `;
}

// 3. Hantera skapande och ritning av Waypoints (utan prickar och text)
const toggleBtn = document.getElementById('toggle-wp-mode');
const statusText = document.getElementById('wp-status');

toggleBtn.addEventListener('click', () => {
    waypointMode = !waypointMode;
    toggleBtn.classList.toggle('active', waypointMode);
    toggleBtn.textContent = waypointMode ? 'Avsluta Waypoint-läge' : 'Aktivera klick på karta för Waypoint';
    statusText.textContent = waypointMode ? 'Läge: AKTIVT (Klicka var som helst på kartan)' : 'Läge: Avstängt';
});

map.on('click', (e) => {
    if (!waypointMode) return;

    const wpId = `wp-${waypointCounter++}`;
    const lat = Number(e.latlng.lat.toFixed(6));
    const lon = Number(e.latlng.lng.toFixed(6));

    addWaypointToMap(wpId, lat, lon, "", "black");
    updateWaypointUI();
});

function addWaypointToMap(wpId, lat, lon, mappedPlatsId, color = 'black') {
    const finalColor = color || 'black';

    const wpObj = {
        id: wpId,
        lat: lat,
        Lon: lon,
        mappedPlatsId: mappedPlatsId,
        color: finalColor
    };

    waypointsState.push(wpObj);
    drawRouteLine();
}

function drawRouteLine() {
    routeLayers.forEach(layer => map.removeLayer(layer));
    routeLayers = new Array();

    if (waypointsState.length >= 2) {
        for (let i = 0; i < waypointsState.length - 1; i++) {
            const startWp = waypointsState.at(i);
            const endWp = waypointsState.at(i + 1);
            const segmentCoords = new Array(
                L.latLng(startWp.lat, startWp.Lon),
                L.latLng(endWp.lat, endWp.Lon)
            );
            const segmentColor = endWp.color || startWp.color || 'black';

            const bgLine = L.polyline(segmentCoords, {
                color: '#ffffff',
                weight: 7,
                opacity: 0.9
            }).addTo(map);

            const fgLine = L.polyline(segmentCoords, {
                color: segmentColor,
                weight: 4,
                opacity: 1
            }).addTo(map);

            routeLayers.push(bgLine, fgLine);
        }
    }
}

// 4. Uppdatera listan och generera JSON
function updateWaypointUI() {
    const listContainer = document.getElementById('waypoint-list');
    listContainer.innerHTML = '';

    waypointsState.forEach((wp, index) => {
        const item = document.createElement('div');
        item.className = 'waypoint-item';

        let optionsHtml = `<option value="">-- Välj knapp att mappa till --</option>`;
        platserData.forEach(p => {
            const selected = wp.mappedPlatsId === p.id ? 'selected' : '';
            optionsHtml += `<option value="${p.id}" ${selected}>${p.Namn} (${p.id})</option>`;
        });

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span><strong>${wp.id}</strong> (${wp.lat}, ${wp.Lon})</span>
                <button data-remove="${index}" style="background:#dc3545; color:white; border:none; border-radius:3px; padding:2px 6px; cursor:pointer; font-size:11px;">Ta bort</button>
            </div>
            <select data-index="${index}">${optionsHtml}</select>
        `;
        listContainer.appendChild(item);
    });

    document.querySelectorAll('#waypoint-list select').forEach(select => {
        select.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-index');
            waypointsState[idx].mappedPlatsId = e.target.value;
            generateJsonOutput();
        });
    });

    document.querySelectorAll('#waypoint-list button[data-remove]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = Number(e.target.getAttribute('data-remove'));
            waypointsState.splice(idx, 1);
            drawRouteLine();
            updateWaypointUI();
        });
    });

    generateJsonOutput();
}

function generateJsonOutput() {
    const formattedOutput = {
        waypoints: waypointsState.map(wp => ({
            waypoint: {
                lat: wp.lat,
                Lon: wp.Lon,
                id: wp.mappedPlatsId || wp.id,
                color: wp.color
            }
        }))
    };

    document.getElementById('json-output').value = JSON.stringify(formattedOutput, null, 2);
}

document.getElementById('copy-json').addEventListener('click', () => {
    const textarea = document.getElementById('json-output');
    textarea.select();
    navigator.clipboard.writeText(textarea.value);
    alert('JSON kopierad till urklipp!');
});
