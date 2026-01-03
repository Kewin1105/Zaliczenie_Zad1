import './style.css'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerUrl from 'leaflet/dist/images/marker-icon.png'
import markerRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconUrl: markerUrl,
  iconRetinaUrl: markerRetinaUrl,
  shadowUrl: markerShadowUrl,
})

const defaultIcon = L.icon({
  iconUrl: markerUrl,
  iconRetinaUrl: markerRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
})

const API_BASE = 'https://api.open-meteo.com/v1/forecast'

let map
let tempMarker = null
const travelGoals = []
const markers = []

const formatCoords = (lat, lon) => `${lat.toFixed(4)}, ${lon.toFixed(4)}`
const escapeHtml = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const findMarkerIndex = id => markers.findIndex(m => m.id === id)
const removeMarkerById = id => {
  const i = findMarkerIndex(id)
  if (i === -1) return
  try { markers[i].marker.remove() } catch (e) {}
  markers.splice(i, 1)
}

function createGoalItem(goal) {
  const li = document.createElement('li')
  li.className = 'goal-item'
  li.dataset.id = goal.id

  li.innerHTML = `
    <div class="goal-main">
      <div class="goal-left">
        <strong class="goal-title">Cel podróży</strong>
        <div class="muted coords">${formatCoords(goal.lat, goal.lng)}</div>
        <div class="weather-desc small">${escapeHtml(weatherCodeToText(goal.weathercode))}</div>
      </div>
      <div class="goal-meta">
        <div class="goal-temp">${goal.temp}°C</div>
        <div class="goal-actions">
          <button class="goto" title="Wyśrodkuj mapę na tym markerze">Pokaż</button>
          <button class="remove" title="Usuń cel z listy i marker z mapy">Usuń</button>
        </div>
      </div>
    </div>
    <div class="goal-note">${escapeHtml(goal.note || '')}</div>
  `

  li.querySelector('.remove').addEventListener('click', () => {
    const idx = travelGoals.findIndex(g => g.id === goal.id)
    if (idx === -1) return
    travelGoals.splice(idx, 1)
    removeMarkerById(goal.id)
    renderGoals()
  })

  li.querySelector('.goto').addEventListener('click', () => {
    const mi = markers.find(m => m.id === goal.id)
    if (!mi || !mi.marker || !map) return
    try {
      map.setView(mi.marker.getLatLng(), 10, { animate: true })
      mi.marker.openPopup()
    } catch (e) { console.error(e) }
  })

  return li
}

function renderGoals() {
  const ul = document.getElementById('goals-list')
  ul.innerHTML = ''
  for (const g of travelGoals) ul.appendChild(createGoalItem(g))
}

function generateNote(temp, weathercode) {
  const notes = []
  if (typeof temp === 'number') {
    if (temp < 0) notes.push('Bardzo zimno — ubierz się bardzo ciepło')
    else if (temp < 10) notes.push('Ubierz się ciepło')
    else if (temp < 18) notes.push('Weź ze sobą kurtkę')
    else if (temp < 26) notes.push('Pogoda umiarkowana')
    else notes.push('Ciepło — krótki rękaw wystarczy')
  }

  const rainCodes = [51, 53, 55, 61, 63, 65, 80, 81, 82]
  const snowCodes = [71, 73, 75, 77]
  const thunderCodes = [95, 96, 99]

  if (rainCodes.includes(weathercode)) notes.push('Możliwe opady — zabierz parasol')
  if (snowCodes.includes(weathercode)) notes.push('Możliwe opady śniegu — odpowiednie buty')
  if (thunderCodes.includes(weathercode)) notes.push('Burze możliwe — uważaj na niebezpieczne warunki')

  return notes.length ? notes.join(' — ') : ''
}

function weatherCodeToText(code) {
  const map = {
    0: 'Bezchmurnie', 1: 'Głównie bezchmurnie', 2: 'Częściowo pochmurnie', 3: 'Całkowite zachmurzenie',
    45: 'Mgła', 48: 'Osadzanie szronu', 51: 'Mżawka (słaba)', 53: 'Mżawka (umiarkowana)', 55: 'Mżawka (intensywna)',
    56: 'Zamglenie zamarzające (słabe)', 57: 'Zamglenie zamarzające (intensywne)',
    61: 'Deszcz (słaby)', 63: 'Deszcz (umiarkowany)', 65: 'Deszcz (intensywny)',
    66: 'Marznący deszcz (słaby)', 67: 'Marznący deszcz (intensywny)',
    71: 'Opady śniegu (słabe)', 73: 'Opady śniegu (umiarkowane)', 75: 'Opady śniegu (intensywne)', 77: 'Płatki śniegu',
    80: 'Przelotne opady deszczu (słabe)', 81: 'Przelotne opady deszczu (umiarkowane)', 82: 'Przelotne opady deszczu (intensywne)',
    85: 'Przelotne opady śniegu (słabe)', 86: 'Przelotne opady śniegu (intensywne)',
    95: 'Burze', 96: 'Burze z gradem (słabe)', 99: 'Burze z gradem (intensywne)'
  }
  return map[code] || 'Nieznana pogoda'
}

function showWeatherCard({lat, lon, temp, weathercode}) {
  const card = document.getElementById('weather-card')
  card.innerHTML = ''

  const title = document.createElement('h3')
  title.textContent = `Pogoda dla: ${formatCoords(lat, lon)}`

  const info = document.createElement('p')
  info.innerHTML = `Temperatura: <strong>${temp}°C</strong>`

  const descEl = document.createElement('div')
  descEl.className = 'weather-desc'
  descEl.textContent = weatherCodeToText(weathercode)

  const suggested = typeof temp === 'number' ? generateNote(temp, weathercode) : ''
  const noteEl = document.createElement('div')
  noteEl.className = 'suggested-note'
  noteEl.textContent = suggested || 'Brak sugestii'

  const addBtn = document.createElement('button')
  addBtn.textContent = 'Dodaj do celów'
  addBtn.className = 'primary'

  addBtn.addEventListener('click', () => {
    const note = suggested || ''
    const itemId = Date.now() + Math.random()
    if (tempMarker) {
      tempMarker._id = itemId
      markers.push({ id: itemId, marker: tempMarker })
      tempMarker = null
    }
    const goal = { id: itemId, lat, lng: lon, temp, weathercode, note, title: `Miejsce ${formatCoords(lat, lon)}` }
    travelGoals.push(goal)
    renderGoals()
  })

  card.appendChild(title)
  card.appendChild(info)
  card.appendChild(descEl)
  card.appendChild(noteEl)
  card.appendChild(addBtn)
}

async function fetchWeather(lat, lon) {
  const url = `${API_BASE}?latitude=${lat}&longitude=${lon}&current_weather=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Błąd sieci')
  const data = await res.json()
  if (!data.current_weather) throw new Error('Brak danych pogodowych')
  return data.current_weather
}

function initMap() {
  map = L.map('map').setView([20, 0], 2)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)

  map.on('popupopen', (e) => {
    try {
      const popupEl = e.popup.getElement()
      const btn = popupEl && popupEl.querySelector && popupEl.querySelector('button.remove-marker')
      if (!btn) return
      btn.addEventListener('click', () => {
        const marker = e.popup._source
        if (marker) removeMarkerById(marker._id)
        map.closePopup()
      })
    } catch (err) { /* ignore */ }
  })

  map.on('click', async (e) => {
    const { lat, lng } = e.latlng
    try {
      const cw = await fetchWeather(lat, lng)
      const desc = weatherCodeToText(cw.weathercode)
      if (tempMarker) try { tempMarker.remove() } catch (e) {}
      tempMarker = L.marker([lat, lng], { icon: defaultIcon }).addTo(map)
      tempMarker.bindPopup(`Temp: ${cw.temperature}°C — ${desc}`).openPopup()
      showWeatherCard({ id: null, lat, lon: lng, temp: cw.temperature, weathercode: cw.weathercode })
    } catch (err) {
      console.error(err)
      showWeatherCard({ lat, lon: lng, temp: '—', weathercode: '—' })
    }
  })
}

document.addEventListener('DOMContentLoaded', () => { initMap(); renderGoals() })
