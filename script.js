// Function to fetch the IP address using a free API
function getIPAddress() {
    fetch('https://api.ipify.org?format=json')
    .then(response => response.json())
    .then(data => {
        document.getElementById('ip').textContent = `Your IP Address: ${data.ip}`;
        getLocation(data.ip);
    })
    .catch(error => {
        console.error('Error fetching IP address:', error);
        document.getElementById('ip').textContent = 'Failed to fetch IP';
    });
}

// Function to fetch location using IP address
function getLocation(ip) {
    fetch(`https://ipapi.co/${ip}/json/`)
    .then(response => response.json())
    .then(data => {
        const locationString = `${data.city}, ${data.region}, ${data.country_name}`;
        document.getElementById('location').textContent = `Your Location: ${locationString}`;
        const lat = data.latitude;
        const lon = data.longitude;
        loadMap(lat, lon);
        getWeather(lat, lon);
    })
    .catch(error => {
        console.error('Error fetching location:', error);
        document.getElementById('location').textContent = 'Failed to fetch location';
    });
}

// Function to load map
function loadMap(lat, lon) {
    const map = L.map('map').setView([lat, lon], 11); // Slightly zoomed out
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);
}

// Function to fetch weather data
function getWeather(lat, lon) {
    const apiKey = '55c5f02350ae494b8f4202330241405';
    fetch(`https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lon}`)
    .then(response => response.json())
    .then(data => {
        const weatherString = `Temperature: ${data.current.temp_c}°C, ${data.current.condition.text}`;
        document.getElementById('weather').textContent = `Current Weather: ${weatherString}`;
    })
    .catch(error => {
        console.error('Error fetching weather:', error);
        document.getElementById('weather').textContent = 'Failed to fetch weather';
    });
}

// Call the function when the page loads
window.onload = getIPAddress;
