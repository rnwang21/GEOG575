let map;

//instantiate the Leaflet map
function createMap() {
    // create the map
    map = L.map("map", {
      center: [20, 0],
      zoom: 2,
    });
  
    // add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(map);
    // load data
    getData(map);
  }

//retrieve the data and place it on the map
function onEachFeature(feature, layer) {
    let popupContent = "";
    if (feature.properties) {
      for (const property in feature.properties) {
        popupContent += `<p>${property}: ${feature.properties[property]}</p>`;
      }
      layer.bindPopup(popupContent);
    }
  }

//function to retrieve the data and place it on the map
function getData(map) {
    fetch("data/MegaCities.geojson")
      .then((response) => response.json())
      .then((json) => {
        const geoLayer = L.geoJSON(json, { onEachFeature }).addTo(map);
        map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] }); 
      })
      .catch((err) => console.error("Failed to load GeoJSON:", err));
  }
  
document.addEventListener("DOMContentLoaded", createMap);
