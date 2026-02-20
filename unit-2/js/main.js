//instantiate the Leaflet map
function createMap() {
    // create the map
    map = L.map("map", {
      center: [20, 0],
      zoom: 2,
      preferCanvas: true,
    });
  
    // add tile layer
    L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);
    
      getData();
    }
  function getData() {
    fetch("data/footprint.geojson")
      .then((response) => response.json())
      .then((json) => {
        const geoLayer = L.geoJSON(json, {
          pointToLayer: (feature, latlng) =>
            L.circleMarker(latlng, {
              radius: 0.8,
              fillColor: "#42DAE3",
              fillOpacity: 0.6,
              stroke: false,
            }),
        }).addTo(map);
  
        // zoom to data
        map.fitBounds(geoLayer.getBounds(), {
          padding: [20, 20],
          maxZoom: 10,
        });
      })
      .catch((err) => console.error("Failed to load GeoJSON:", err));
  }
  
  document.addEventListener("DOMContentLoaded", createMap);
