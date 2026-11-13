// 1. Initiera kartan (startar över Japan tills waypoints/platser laddats)
const map = L.map('map').setView(L.latLng(36.2048, 138.2529), 5);

const tileUrl = ['https:/', 'tile.openstreetmap.org', '{z}', '{x}', '{y}.png'].join('/');
L.tileLayer(tileUrl, {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Reservdata om platser.json inte hittas
const fallbackData = new Array(
    {
        "id": "tokyo-tower",
        "Namn": "Tokyo Tower",
        "plats": { "lat": 35.6585805, "Lon": 139.7454329 },
        "googlemapLink": ['https:/', '://google.com', 'maps?q=35.6585805,139.7454329'].join('/'),
        "img": ['https:/', 'upload.wikimedia.org', 'wikipedia/commons/thumb/3/37/T%C5%8Dky%C5%8D_Tower_20060211.JPG/640px-T%C5%8Dky%C5%8D_Tower_20060211.JPG'].join('/'),
        "beskrivning": "Ett ikoniskt kommunikations- och observationstorn i Minato, Tokyo."
    },
    {
        "id": "fushimi-inari",
        "Namn": "Fushimi Inari Taisha",
        "plats": { "lat": 34.9671402, "Lon": 135.7726717 },
        "googlemapLink": ['https:/', '://google.com', 'maps?q=34.9671402,135.7726717'].join('/'),
        "img": ['https:/', 'upload.wikimedia.org', 'wikipedia/commons/thumb/0/0e/Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg/640px-Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg'].join('/'),
        "beskrivning": "Berömd shintohelgedom i Kyoto med tusentals röda torii-portar."
    }
);

let platserData = new Array();
let waypointMode = false;
let waypointCounter = 1;
let waypointsState = new Array();
let routeLineBg = null;
let routeLine = null;

// Funktion som anpassar kartans utsnitt och inzoomning efter dina waypoints
function fitMapToWaypoints() {
    if (waypointsState.length === 0) return;

    if (waypointsState.length === 1) {
        // Om det bara finns en waypoint, centrera på den med zoomnivå 14
        const wp = waypointsState.at(0);
        map.setView(L.latLng(wp.lat, wp.Lon), 14);
    } else {
        // Om det finns 2 eller fler, räkna ut yttergränserna och zooma in med marginal
        const coords = waypointsState.map(wp => L.latLng(wp.lat, wp.Lon));
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, {
            padding: L.point(60, 60), // Ger 60px luft runt rutten
            maxZoom: 16               // Förhindrar att kartan zoomar in för extremt nära
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
        console.warn('Använder inbyggd exempeldata:', err);
        platserData = fallbackData;
        renderPlaces(platserData);
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
                data.waypoints.forEach(item => {
                    const wp = item.waypoint || item;
                    if (wp.lat !== undefined && wp.Lon !== undefined) {
                        const matchedPlace = platserData.find(p => p.id === wp.id);
                        const mappedId = matchedPlace ? wp.id : "";
                        const wpId = `wp-${waypointCounter++}`;

                        addWaypointToMap(wpId, Number(wp.lat), Number(wp.Lon), mappedId);
                    }
                });
                updateWaypointUI();

                // Låt waypoints bestämma storleken och inzoomningen på kartan
                fitMapToWaypoints();
            }
        })
        .catch(err => {
            console.log('Ingen sparad waypoints.json hittades i mappen.');
        });
}

function renderPlaces(platser) {
    platser.forEach(plats => {
        const btnIcon = L.divIcon({
            className: '',
            html: `
        <div class="place-marker-container">
          <div class="place-dot"></div>
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

// 3. Hantera skapande och ritning av Waypoints
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

    addWaypointToMap(wpId, lat, lon, "");
    updateWaypointUI();
});

function addWaypointToMap(wpId, lat, lon, mappedPlatsId) {
    const circleMarker = L.circleMarker(L.latLng(lat, lon), {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: '#ff7700',
        fillOpacity: 1
    }).addTo(map);

    circleMarker.bindTooltip(wpId, {
        permanent: true,
        direction: 'top',
        offset: L.point(0, -8)
    });

    const wpObj = {
        id: wpId,
        lat: lat,
        Lon: lon,
        mappedPlatsId: mappedPlatsId,
        marker: circleMarker
    };

    circleMarker.on('click', () => {
        if (wpObj.mappedPlatsId) {
            const plats = platserData.find(p => p.id === wpObj.mappedPlatsId);
            if (plats) {
                showPlaceDetails(plats);
                return;
            }
        }
        circleMarker.bindPopup(`Waypoint: ${wpObj.id}<br>${lat}, ${lon}`).openPopup();
    });

    waypointsState.push(wpObj);
    drawRouteLine();
}

function drawRouteLine() {
    if (routeLineBg) map.removeLayer(routeLineBg);
    if (routeLine) map.removeLayer(routeLine);

    if (waypointsState.length >= 2) {
        const latlngs = waypointsState.map(wp => L.latLng(wp.lat, wp.Lon));

        routeLineBg = L.polyline(latlngs, {
            color: '#ffffff',
            weight: 7,
            opacity: 0.9
        }).addTo(map);

        routeLine = L.polyline(latlngs, {
            color: '#ff7700',
            weight: 4,
            opacity: 1
        }).addTo(map);

        waypointsState.forEach(wp => wp.marker.bringToFront());
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
            map.removeLayer(waypointsState[idx].marker);
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
                id: wp.mappedPlatsId || wp.id
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
