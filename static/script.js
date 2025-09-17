const form = document.getElementById('recommendForm');
const resultDiv = document.getElementById('result');
const submitBtn = document.getElementById('submitBtn');
const regionInput = document.getElementById('region');
const trackLocationBtn = document.getElementById('trackLocationBtn');
// Crop price section elements
const cropSelect = document.getElementById('cropSelect');
const fetchPriceBtn = document.getElementById('fetchPriceBtn');
const priceResult = document.getElementById('priceResult');
// Simple cache for crop prices
const cropPriceCache = {};
// Crop price fetching
fetchPriceBtn.addEventListener('click', async () => {
    const crop = cropSelect.value;
    priceResult.style.display = 'none';
    priceResult.innerHTML = '<span class="spinner"></span> Fetching...';
    fetchPriceBtn.disabled = true;
    try {
        // Use cache if available
        if (cropPriceCache[crop]) {
            renderPriceResult(cropPriceCache[crop]);
        } else {
            const res = await fetch('/getPrices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ crop })
            });
            const data = await res.json();
            // The backend returns min, mod, max
            if (res.ok && data && data.min !== undefined && data.mod !== undefined && data.max !== undefined) {
                cropPriceCache[crop] = { min: data.min, modal: data.mod, max: data.max };
                renderPriceResult(cropPriceCache[crop]);
            } else {
                priceResult.innerHTML = `<span style='color:#ff6b6b;'>${data.error || 'Failed to fetch price.'}</span>`;
                priceResult.style.display = 'block';
            }
        }
    } catch (err) {
        priceResult.innerHTML = `<span style='color:#ff6b6b;'>Error fetching price.</span>`;
        priceResult.style.display = 'block';
    } finally {
        fetchPriceBtn.disabled = false;
    }
});

// Store user's last accessed location
let userLatitude = null;
let userLongitude = null;
let userPlaceInfo = { placeName: '', district: '', state: '' };

// Track location functionality

trackLocationBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        const originalBtnText = trackLocationBtn.innerHTML;
        trackLocationBtn.innerHTML = '<span class="fas fa-spinner fa-spin"></span>';
        trackLocationBtn.disabled = true;
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const { latitude, longitude } = position.coords;
                userLatitude = latitude;
                userLongitude = longitude;
                fetchPlaceInfo(latitude, longitude).then(placeInfo => {
                    userPlaceInfo = placeInfo;
                    regionInput.value = composeRegionString(placeInfo) || 'Unknown Region';
                    trackLocationBtn.innerHTML = originalBtnText;
                    trackLocationBtn.disabled = false;
                });
            },
            function(error) {
                console.error('Geolocation error:', error);
                alert('Geolocation failed. Please enter your region manually.');
                trackLocationBtn.innerHTML = originalBtnText;
                trackLocationBtn.disabled = false;
            }
        );
    } else {
        alert('Geolocation is not supported by your browser.');
    }
});

async function fetchPlaceInfo(latitude, longitude) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await response.json();
        const address = data.address || {};
        let placeName = address.city || address.town || address.village || address.hamlet || '';
        let district = address.state_district || address.county || '';
        let state = address.state || '';
        return { placeName, district, state };
    } catch (error) {
        console.error('Error getting place info:', error);
        return { placeName: '', district: '', state: '' };
    }
}

function composeRegionString(placeInfo) {
    let parts = [];
    if (placeInfo.placeName) parts.push(placeInfo.placeName);
    if (placeInfo.district) parts.push(placeInfo.district);
    if (placeInfo.state) parts.push(placeInfo.state);
    return parts.join(', ');
}

form.addEventListener('submit', async function(e) {
    e.preventDefault();
    resultDiv.style.display = 'none';
    resultDiv.textContent = '';
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner"></span>Processing...';
    const land_area_acres = parseFloat(form.land_area_acres.value);
    const region = form.region.value;
    const water_price_per_liter = parseFloat(form.water_price_per_liter.value);
    const imageInput = form.image.files[0];
    let imageBase64 = null;
    if (imageInput) {
        imageBase64 = await toBase64(imageInput);
    }
    const payload = {
        land_area_acres,
        region,
        water_price_per_liter,
        image: imageBase64
    };
    try {
        const res = await fetch('/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            resultDiv.innerHTML = renderRecommendations(data);
            resultDiv.style.color = '#f1f1f1';
        } else {
            resultDiv.textContent = data.error || 'An error occurred.';
            resultDiv.style.color = '#ff6b6b';
        }
        resultDiv.style.display = 'block';
    } catch (err) {
        resultDiv.textContent = 'Failed to fetch recommendation.';
        resultDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
});

function renderPriceResult(priceObj) {
    function formatRupee(val) {
        if (val === undefined || val === null || val === '' || isNaN(val)) return '-';
        return '₹' + Number(val).toLocaleString('en-IN');
    }
    priceResult.innerHTML = `<div><b>Minimum Price:</b> ${formatRupee(priceObj.min)}<br>
    <b>Modal Price:</b> ${formatRupee(priceObj.modal)}<br>
    <b>Maximum Price:</b> ${formatRupee(priceObj.max)}</div>`;
    priceResult.style.color = '#f1f1f1';
    priceResult.style.display = 'block';
}

function renderRecommendations(data) {
    if (!data || !data.crop_recommendations || !Array.isArray(data.crop_recommendations)) {
        return '<span>No recommendations found.</span>';
    }
    function formatRupee(val) {
        if (val === undefined || val === null || val === '' || isNaN(val)) return '-';
        return '₹' + Number(val).toLocaleString('en-IN');
    }
    let html = '';
    data.crop_recommendations.forEach((rec, idx) => {
        html += `<div style=\"margin-bottom: 28px; border-bottom: 1px solid #333; padding-bottom: 18px;\">\n                    <h2 style='color:#7ed957; font-size:1.2rem; margin-bottom:8px;'>${idx+1}. ${rec.crop_name}</h2>\n                    <div><b>Reasoning:</b> ${rec.reasoning || '-'}</div>\n                    <div><b>Best Seeds:</b> ${Array.isArray(rec.best_seeds) ? rec.best_seeds.map(seed => `<span style='background:#2c2f33; border-radius:4px; padding:2px 8px; margin-right:4px;'>${seed}</span>`).join('') : '-'}</div>\n                    <div><b>Required Tools:</b> ${Array.isArray(rec.required_tools) ? rec.required_tools.map(tool => `<span style='background:#2c2f33; border-radius:4px; padding:2px 8px; margin-right:4px;'>${tool}</span>`).join('') : '-'}</div>\n                    <div style='margin-top:8px;'><b>Estimated Cost (1 year):</b></div>\n                    <ul style='margin:0 0 0 18px; padding:0; list-style:disc;'>\n                        <li><b>Total:</b> ${formatRupee(rec.estimated_cost_per_year?.total_cost)} </li>\n                        <li><b>Seeds:</b> ${formatRupee(rec.estimated_cost_per_year?.breakdown?.seeds)} </li>\n                        <li><b>Water:</b> ${formatRupee(rec.estimated_cost_per_year?.breakdown?.water)} </li>\n                        <li><b>Fertilizer:</b> ${formatRupee(rec.estimated_cost_per_year?.breakdown?.fertilizer)} </li>\n                        <li><b>Tools/Equipment:</b> ${formatRupee(rec.estimated_cost_per_year?.breakdown?.tools_and_equipment)} </li>\n                        <li><b>Labor:</b> ${formatRupee(rec.estimated_cost_per_year?.breakdown?.labor)} </li>\n                    </ul>\n                </div>`;
    });
    return html;
}


function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}


// --- Weather Session ---
window.addEventListener('DOMContentLoaded', () => {
    showWeatherLoading();
        // On page load, get location, then place info, then fetch weather
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    userLatitude = position.coords.latitude;
                    userLongitude = position.coords.longitude;
                    userPlaceInfo = await fetchPlaceInfo(userLatitude, userLongitude);
                    // Now update weather section title with place info
                    const weatherSection = document.getElementById('weatherSection');
                    if (weatherSection) {
                        let placeStr = composeRegionString(userPlaceInfo);
                        weatherSection.querySelector('h2').innerHTML = `Current Weather${placeStr ? ' in ' + placeStr : ''}`;
                    }
                    fetchWeatherAndDisplay();
                },
                (error) => {
                    showWeatherError('Geolocation failed. Cannot fetch weather.');
                }
            );
        } else {
            showWeatherError('Geolocation is not supported by your browser.');
        }
});

function showWeatherLoading() {
    const weatherSection = document.getElementById('weatherSection');
    const weatherInfo = document.getElementById('weatherInfo');
    if (weatherSection) {
        let placeStr = composeRegionString(userPlaceInfo);
        weatherSection.querySelector('h2').innerHTML = `Current Weather${placeStr ? ' in ' + placeStr : ''}`;
    }
    if (weatherInfo) {
        weatherInfo.innerHTML = '<span class="spinner"></span> Loading weather data...';
    }
    const weatherChart = document.getElementById('weatherChart');
    if (weatherChart) {
        weatherChart.style.display = 'none';
    }
}

function fetchWeatherAndDisplay() {
    // If location is not yet set, fetch it first
    if (userLatitude === null || userLongitude === null) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLatitude = position.coords.latitude;
                    userLongitude = position.coords.longitude;
                    fetchWeatherAndDisplay(); // Retry after getting location
                },
                (error) => {
                    showWeatherError('Geolocation failed. Cannot fetch weather.');
                }
            );
        } else {
            showWeatherError('Geolocation is not supported by your browser.');
            return;
        }
    } else {
        fetch('/weather', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: userLatitude, longitude: userLongitude })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                showWeatherError(data.error);
                return;
            }
            displayWeatherData(data);
        })
        .catch(err => {
            showWeatherError('Weather fetch error: ' + err);
        });
    }
}

function showWeatherError(msg) {
    const weatherInfo = document.getElementById('weatherInfo');
    if (weatherInfo) {
        weatherInfo.innerHTML = `<span style="color:#ff6b6b;">${msg}</span>`;
    }
    const weatherChart = document.getElementById('weatherChart');
    if (weatherChart) {
        weatherChart.style.display = 'none';
    }
}

function displayWeatherData(data) {
    // Show summary for current hour
    const weatherSection = document.getElementById('weatherSection');
    if (weatherSection) {
        let placeStr = composeRegionString(userPlaceInfo);
        weatherSection.querySelector('h2').innerHTML = `Current Weather${placeStr ? ' in ' + placeStr : ''}`;
    }
    const weatherInfo = document.getElementById('weatherInfo');
    if (!weatherInfo || !data || !data.date || !data.temperature_2m) return;
    // Find current hour index (closest to now)
    const now = new Date();
    let idx = 0;
    function parseISTDate(str) {
        // Remove ' IST' and parse as local time
        return new Date(str.replace(' IST', ''));
    }
    for (let i = 0; i < data.date.length; i++) {
        const d = parseISTDate(data.date[i]);
        if (d > now) break;
        idx = i;
    }
    // Compose weather summary
    const temp = data.temperature_2m[idx];
    const rain = data.rain[idx];
    const wind = data.wind_speed_10m[idx];
    const soil = data.soil_moisture_0_to_1cm[idx];
    const locationStr = composeRegionString(userPlaceInfo);
    weatherInfo.innerHTML = `
        <b>Location:</b> ${locationStr || 'Failed to get place name'}<br>
        <b>Time:</b> ${parseISTDate(data.date[idx]).toLocaleString()} IST<br>
        <b>Temperature:</b> ${temp.toFixed(1)}°C<br>
        <b>Rain:</b> ${rain} mm<br>
        <b>Wind:</b> ${wind} m/s<br>
        <b>Soil Moisture:</b> ${soil.toFixed(3)} m³/m³
    `;

    // Show chart
    renderWeatherChart(data);
}

function renderWeatherChart(data) {
    const ctx = document.getElementById('weatherChart').getContext('2d');
    document.getElementById('weatherChart').style.display = 'block';
    // Destroy previous chart if exists
    if (window.weatherChartInstance) {
        window.weatherChartInstance.destroy();
    }
    // Prepare chart data
    function parseISTDate(str) {
        return new Date(str.replace(' IST', ''));
    }
    const labels = data.date.map(d => {
        const dt = parseISTDate(d);
        return dt.getHours() + ':00';
    });
    window.weatherChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: data.temperature_2m,
                    borderColor: '#7ed957',
                    backgroundColor: 'rgba(126,217,87,0.1)',
                    yAxisID: 'y',
                    tension: 0.3,
                },
                {
                    label: 'Rain (mm)',
                    data: data.rain,
                    borderColor: '#57a7ed',
                    backgroundColor: 'rgba(87,167,237,0.1)',
                    yAxisID: 'y1',
                    tension: 0.3,
                },
                {
                    label: 'Soil Moisture',
                    data: data.soil_moisture_0_to_1cm,
                    borderColor: '#edc957',
                    backgroundColor: 'rgba(237,201,87,0.1)',
                    yAxisID: 'y2',
                    tension: 0.3,
                }
            ]
        },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            stacked: false,
            plugins: {
                legend: { labels: { color: '#f1f1f1' } },
                title: { display: false }
            },
            scales: {
                x: { ticks: { color: '#f1f1f1' }, grid: { color: '#333' } },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Temperature (°C)', color: '#7ed957' },
                    ticks: { color: '#7ed957' },
                    grid: { color: '#333' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Rain (mm)', color: '#57a7ed' },
                    ticks: { color: '#57a7ed' },
                    grid: { drawOnChartArea: false }
                },
                y2: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Soil Moisture', color: '#edc957' },
                    ticks: { color: '#edc957' },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

// Load Chart.js dynamically if not present
if (typeof Chart === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => {
        // Chart.js loaded, re-render if needed
    };
    document.head.appendChild(script);
}
