let map;                     // Leaflet map object
let minValue;                // smallest data value used for symbol scaling
let sequenceControl;         // temporal slider control
let symbolLegendControl;     // proportional symbol legend control

//instantiate the Leaflet map
function createMap() {
  map = L.map("map", {
    center: [20, 0],
    zoom: 2,
    preferCanvas: true,
  });

  // add OpenStreetMap basemap
  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }
  ).addTo(map);

  // load GeoJSON data
  getData();
}

//Define temporal attributes used in the sequence slider
function processData(data) {
    return [
      "population_2015",
      "population_2016",
      "population_2017",
      "population_2018",
      "population_2019",
      "population_2020",
      "population_2021"
    ];
}

//Calculate the minimum data value: Used for proportional symbol scaling
function calcMinValue(data, attribute) {
  let values = [];
  data.features.forEach((feature) => {
    const v = Number(feature.properties[attribute]);
    if (Number.isFinite(v) && v > 0) values.push(v);
  });
  return Math.min(...values);
}

// calculate proportional symbol radius
function calcPropRadius(attValue) {
    const minRadius = 5;
    return 1.0083 * Math.pow(attValue / minValue, 0.5715) * minRadius;
}

// Update the temporal legend text
function updateLegend(attribute) {
    const year = attribute.split("_")[1];
    const legend = document.querySelector("#temporalLegend");
    if (legend) {
      legend.innerHTML = `<b>Population Year:</b> ${year}`;
    }
  }

// Create proportional symbol legend container, appears on bottom-right of the map
function createSymbolLegend() {
  symbolLegendControl = L.control({ position: "bottomright" });

  symbolLegendControl.onAdd = function () {
    const div = L.DomUtil.create("div", "legend-control-container");
    div.innerHTML = `
      <div id="symbolLegendTitle"><b>Population</b></div>
      <svg id="symbolLegendSVG" width="180" height="100"></svg>
    `;
    L.DomEvent.disableClickPropagation(div);
    return div;
  };

  symbolLegendControl.addTo(map);
}

// Update the proportional symbol legend based on current attribute values
function updateSymbolLegend(attribute) {
  let values = [];

  map.eachLayer(function(layer) {
    if (layer.feature && layer.feature.properties && layer.feature.properties[attribute] != null) {
      const v = Number(layer.feature.properties[attribute]);
      if (Number.isFinite(v) && v > 0) values.push(v);
    }
  });

  if (values.length === 0) return;

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const midVal = (minVal + maxVal) / 2;

  const svg = document.querySelector("#symbolLegendSVG");
  const title = document.querySelector("#symbolLegendTitle");
  if (!svg || !title) return;

  const year = attribute.split("_")[1];
  title.innerHTML = `<b>Population</b><br>${year}`;

  const rMax = calcPropRadius(maxVal);
  const rMid = calcPropRadius(midVal);
  const rMin = calcPropRadius(minVal);

  // all circles share the same bottom baseline
  const cx = rMax + 12;
  const baseY = rMax * 2 + 12;

  const cyMax = baseY - rMax;
  const cyMid = baseY - rMid;
  const cyMin = baseY - rMin;

  // place lines near the upper-right edge of each circle
  const yMax = cyMax - rMax * 0.85;
  const yMid = cyMid - rMid * 0.85;
  const yMin = cyMin - rMin * 0.85;

  // compute exact circle-line intersection on the right side
  const x1Max = cx + Math.sqrt(rMax * rMax - Math.pow(yMax - cyMax, 2));
  const x1Mid = cx + Math.sqrt(rMid * rMid - Math.pow(yMid - cyMid, 2));
  const x1Min = cx + Math.sqrt(rMin * rMin - Math.pow(yMin - cyMin, 2));

  // labels further right
  const labelX = cx + rMax + 35;

  svg.setAttribute("width", 240);
  svg.setAttribute("height", baseY + 15);

  svg.innerHTML = `
    <!-- largest circle -->
    <circle cx="${cx}" cy="${cyMax}" r="${rMax}"
      fill="rgba(255,255,0,0.6)" stroke="#000" stroke-width="1"></circle>
    <line x1="${x1Max}" y1="${yMax}" x2="${labelX - 6}" y2="${yMax}"
      stroke="#666" stroke-dasharray="2,2"></line>
    <text x="${labelX}" y="${yMax + 4}" font-size="11">${Math.round(maxVal).toLocaleString()}</text>

    <!-- middle circle -->
    <circle cx="${cx}" cy="${cyMid}" r="${rMid}"
      fill="rgba(255,255,0,0.6)" stroke="#000" stroke-width="1"></circle>
    <line x1="${x1Mid}" y1="${yMid}" x2="${labelX - 6}" y2="${yMid}"
      stroke="#666" stroke-dasharray="2,2"></line>
    <text x="${labelX}" y="${yMid + 4}" font-size="11">${Math.round(midVal).toLocaleString()}</text>

    <!-- smallest circle -->
    <circle cx="${cx}" cy="${cyMin}" r="${rMin}"
      fill="rgba(255,255,0,0.6)" stroke="#000" stroke-width="1"></circle>
    <line x1="${x1Min}" y1="${yMin}" x2="${labelX - 6}" y2="${yMin}"
      stroke="#666" stroke-dasharray="2,2"></line>
    <text x="${labelX}" y="${yMin + 4}" font-size="11">${Math.round(minVal).toLocaleString()}</text>
  `;
}

// Convert markers to circle markers and bind popups
function pointToLayer(feature, latlng, attribute) {

  const options = {
    fillColor: "yellow",
    color: "#000",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.6
  };

  const attValue = Number(feature.properties[attribute]);
  options.radius = calcPropRadius(attValue);

  const layer = L.circleMarker(latlng, options);
  const props = feature.properties;

  const year = attribute.split("_")[1];

  // NEW: add long-term change for interpretation
  const pop2015 = Number(props.population_2015);
  const pop2021 = Number(props.population_2021);
  const absChange = pop2021 - pop2015;
  const pctChange = ((absChange / pop2015) * 100).toFixed(1);

  let popupContent = `<p><b>MSA:</b> ${props.msa}</p>`;
  popupContent += `<p><b>Anchor city:</b> ${props.anchor_city}</p>`;
  popupContent += `<p><b>Population in ${year}:</b> ${attValue.toLocaleString()}</p>`;
  popupContent += `<p><b>Change 2015–2021:</b> ${absChange.toLocaleString()} (${pctChange}%)</p>`;

  layer.bindPopup(popupContent, {
    offset: new L.Point(0, -options.radius)
  });

  return layer;
}

// Add circle markers for point features to the map based on attributes
function createPropSymbols(data, attributes) {

  const attribute = attributes[0];
  minValue = calcMinValue(data, attribute);

  const geoLayer = L.geoJSON(data, {
    pointToLayer: function(feature, latlng) {
      return pointToLayer(feature, latlng, attribute);
    }
  }).addTo(map);

  updateLegend(attribute);
  updateSymbolLegend(attribute);

  map.fitBounds(geoLayer.getBounds(), {
    padding: [20, 20],
    maxZoom: 10
  });
}

  // create slider + step buttons
function createSequenceControls(attributes) {

  sequenceControl = L.control({ position: "bottomleft" });

  sequenceControl.onAdd = function () {

    const div = L.DomUtil.create("div", "sequence-control-container");

    div.innerHTML = `
      <div id="temporalLegend"></div>
      <input class="range-slider" type="range">
      <button class="step" id="reverse">Reverse</button>
      <button class="step" id="forward">Forward</button>
    `;

    L.DomEvent.disableClickPropagation(div);
    return div;
  };

  sequenceControl.addTo(map);

  const slider = document.querySelector(".range-slider");

  slider.max = attributes.length - 1;
  slider.min = 0;
  slider.value = 0;
  slider.step = 1;

  document.querySelectorAll(".step").forEach(function(step) {

    step.addEventListener("click", function() {

      let index = Number(slider.value);

      if (step.id === "forward") {
        index = (index + 1) % attributes.length;
      } else {
        index = (index - 1 + attributes.length) % attributes.length;
      }

      slider.value = index;
      updatePropSymbols(attributes[index]);
    });
  });

  slider.addEventListener("input", function() {
    updatePropSymbols(attributes[this.value]);
  });
}


// Update proportional symbols based on selected attribute
function updatePropSymbols(attribute) {

  let values = [];

  map.eachLayer(function(layer) {
    if (layer.feature && layer.feature.properties && layer.feature.properties[attribute] != null) {
      const v = Number(layer.feature.properties[attribute]);
      if (Number.isFinite(v) && v > 0) values.push(v);
    }
  });

  minValue = Math.min(...values);

  map.eachLayer(function(layer) {

    if (layer.feature && layer.feature.properties && layer.feature.properties[attribute] != null) {

      const props = layer.feature.properties;

      const attValue = Number(props[attribute]);
      const radius = calcPropRadius(attValue);

      layer.setRadius(radius);

      const year = attribute.split("_")[1];

      const pop2015 = Number(props.population_2015);
      const pop2021 = Number(props.population_2021);
      const absChange = pop2021 - pop2015;
      const pctChange = ((absChange / pop2015) * 100).toFixed(1);

      let popupContent = `<p><b>MSA:</b> ${props.msa}</p>`;
      popupContent += `<p><b>Anchor city:</b> ${props.anchor_city}</p>`;
      popupContent += `<p><b>Population in ${year}:</b> ${attValue.toLocaleString()}</p>`;
      popupContent += `<p><b>Change 2015–2021:</b> ${absChange.toLocaleString()} (${pctChange}%)</p>`;

      layer.getPopup().setContent(popupContent);
    }
  });

  updateLegend(attribute);
  updateSymbolLegend(attribute);
}


// load data
function getData() {

  fetch("data/cities.geojson")
    .then(res => res.json())
    .then(json => {

      const attributes = processData(json);

      createSequenceControls(attributes);
      createSymbolLegend();
      createPropSymbols(json, attributes);

    })
    .catch(err => console.error(err));
}
  
document.addEventListener("DOMContentLoaded", createMap);
