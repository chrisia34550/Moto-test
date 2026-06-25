const net = require('net');
const fs = require('fs');
const express = require('express');
const app = express();
const PORT_GPS = 5013;
const PORT_WEB = 3000;

app.use(express.json());
app.use(express.static(__dirname));

function convertir(raw) {
    let point = raw.indexOf('.');
    let deg = parseFloat(raw.substring(0, point - 2));
    let min = parseFloat(raw.substring(point - 2)) / 60;
    return deg + min;
}

// API DE DONNÉES
app.get('/data', (req, res) => {
    let trajets = [];
    if (fs.existsSync('positions.txt')) {
        const lines = fs.readFileSync('positions.txt', 'utf8').split('\n');
        lines.forEach(line => {
            if (line.includes(',A,')) {
                let parts = line.split(',');
                trajets.push([convertir(parts[5]), convertir(parts[7])]);
            }
        });
    }
    res.json(trajets);
});

// EXPORT KML
app.get('/export', (req, res) => {
    let kml = '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><LineString><coordinates>';
    if (fs.existsSync('positions.txt')) {
        const lines = fs.readFileSync('positions.txt', 'utf8').split('\n');
        lines.forEach(line => {
            if (line.includes(',A,')) {
                let p = line.split(',');
                kml += `${convertir(p[7])},${convertir(p[5])},0 `;
            }
        });
    }
    kml += '</coordinates></LineString></Placemark></Document></kml>';
    res.attachment('trajet.kml');
    res.send(kml);
});

// INTERFACE WEB
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
                <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
                <style>
                    body { font-family: sans-serif; margin: 0; display: flex; flex-direction: column; height: 100vh; }
                    #controls { padding: 15px; background: #333; color: white; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
                    #map { flex-grow: 1; }
                </style>
            </head>
            <body>
                <div id="controls">
                    <strong>ST-901 :</strong>
                    <select id="cmdSelect">
                        <option value="6690000">Localiser (Lien Google)</option>
                        <option value="9400000">Couper Moteur</option>
                        <option value="9410000">Rétablir Moteur</option>
                        <option value="RCONF">Lire Config</option>
                        <option value="8040000 45.112.204.246 8090">Config IP/Port</option>
                        <option value="SLEEP0000 5">Mode Sleep (5 min)</option>
                        <option value="SLEEP0000 0">Désactiver Sleep</option>
                    </select>
                    <button onclick="envoyerSMS()">Envoyer SMS</button>
                    <button onclick="window.location.href='/export'">📥 KML</button>
                </div>
                <div id="map"></div>
                <script>
                    const map = L.map('map').setView([43.36, 3.41], 13);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                    let polyline = L.polyline([], {color: 'blue', weight: 5}).addTo(map);
                    
                    function envoyerSMS() {
                        const tel = "+33759671722"; // REMPLACEZ PAR VOTRE VRAI NUMÉRO SIM
                        window.location.href = "sms:" + tel + "?body=" + document.getElementById('cmdSelect').value;
                    }
                    async function update() {
                        const res = await fetch('/data');
                        const coords = await res.json();
                        if(coords.length > 0) {
                            polyline.setLatLngs(coords);
                            map.panTo(coords[coords.length-1]);
                        }
                    }
                    setInterval(update, 3000);
                    update();
                </script>
            </body>
        </html>
    `);
});

// SERVEUR GPS
net.createServer((socket) => {
    socket.on('data', (data) => {
        const trame = data.toString().trim();
        if(trame.includes('*HQ') && trame.split(',')[4] === 'A') {
            fs.appendFileSync('positions.txt', trame + '\n');
            console.log(`[DATA] : ${trame}`);
        }
    });
}).listen(PORT_GPS, () => console.log('✅ Serveur GPS : Port 5013 actif'));

app.listen(PORT_WEB, () => console.log('✅ Serveur Web : http://localhost:3000'));