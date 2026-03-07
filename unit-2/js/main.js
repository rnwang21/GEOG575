let map;
let minValue;
let sequenceControl;
let symbolLegendControl;

//instantiate the Leaflet map
function createMap() {
  map = L.map("map", {
    center: [20, 0],
    zoom: 2,
    preferCanvas: true,
  });

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }
  ).addTo(map);

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

    map.eachLayer(function (layer) {
      if (layer.feature && layer.feature.properties && layer.feature.properties[attribute] != null) {
        const v = Number(layer.feature.properties[attribute]);
        if (Number.isFinite(v) && v > 0) values.push(v);
      }
    });

    if (values.length === 0) return;

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const midVal = (minVal + maxVal) / 2;

    const circles = [
      { value: maxVal, label: Math.round(maxVal).toLocaleString() },
      { value: midVal, label: Math.round(midVal).toLocaleString() },
      { value: minVal, label: Math.round(minVal).toLocaleString() }
    ];

    const svg = document.querySelector("#symbolLegendSVG");
    const title = document.querySelector("#symbolLegendTitle");
    if (!svg || !title) return;

    const year = attribute.split("_")[1];
    title.innerHTML = `<b>Population</b><br>${year}`;

    const largestRadius = calcPropRadius(maxVal);
    const cx = largestRadius + 10;
    const baseY = largestRadius * 2 + 10;
    const labelX = cx + largestRadius + 20;

    svg.setAttribute("width", labelX + 70);
    svg.setAttribute("height", baseY + 10);

    let svgContent = "";

    circles.forEach((circle) => {
      const r = calcPropRadius(circle.value);
      const cy = baseY - r;

      svgContent += `
        <circle cx="${cx}" cy="${cy}" r="${r}"
          fill="rgba(255,255,0,0.6)" stroke="#000" stroke-width="1"></circle>
        <line x1="${cx + r}" y1="${cy}" x2="${labelX - 5}" y2="${cy}"
          stroke="#666" stroke-dasharray="2,2"></line>
        <text x="${labelX}" y="${cy + 4}" font-size="11">${circle.label}</text>
      `;
    });

    svg.innerHTML = svgContent;
  }

// Convert markers to circle markers and bind popups
function pointToLayer(feature, latlng, attribute) {

    // marker options
    const options = {
      fillColor: "yellow",
      color: "#000", 
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8,
    };

    const attValue = Number(feature.properties[attribute]);
    options.radius = calcPropRadius(attValue);
    // create circle marker layer
    const layer = L.circleMarker(latlng, options);
    const props = feature.properties;

    // popup content
    const year = attribute.split("_")[1];
    let popupContent = `<p><b>MSA:</b> ${props.msa}</p>`;
    popupContent += `<p><b>Anchor city:</b> ${props.anchor_city}</p>`;
    popupContent += `<p><b>Population in ${year}:</b> ${Number(attValue).toLocaleString()}</p>`;

    // bind popup with offset (so it doesn't cover the circle)
    layer.bindPopup(popupContent, {
      offset: new L.Point(0, -options.radius),
    });

    return layer;
  }

// Add circle markers for point features to the map based on attributes
function createPropSymbols(data, attributes) {
  const attribute = attributes[0];
  minValue = calcMinValue(data, attribute);

  const geoLayer = L.geoJSON(data, {
    pointToLayer: function (feature, latlng) {
      return pointToLayer(feature, latlng, attribute);
    },
  }).addTo(map);

  updateLegend(attribute);
  updateSymbolLegend(attribute);

  map.fitBounds(geoLayer.getBounds(), {
    padding: [20, 20],
    maxZoom: 10,
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
      L.DomEvent.disableScrollPropagation(div);
      return div;
    };

    sequenceControl.addTo(map);

    const slider = document.querySelector(".range-slider");
    slider.max = attributes.length - 1;
    slider.min = 0;
    slider.value = 0;
    slider.step = 1;

    document.querySelectorAll(".step").forEach(function (step) {
      step.addEventListener("click", function () {
        let index = Number(slider.value);

        if (step.id === "forward") {
          index++;
          index = index > attributes.length - 1 ? 0 : index;
        } else if (step.id === "reverse") {
          index--;
          index = index < 0 ? attributes.length - 1 : index;
        }

        slider.value = index;
        updatePropSymbols(attributes[index], attributes);
      });
    });

    slider.addEventListener("input", function () {
      const index = Number(this.value);
      updatePropSymbols(attributes[index], attributes);
    });
  }

  // Update proportional symbols based on selected attribute
  function updatePropSymbols(attribute, attributes) {

    let values = [];
    map.eachLayer(function (layer) {
      if (layer.feature && layer.feature.properties && layer.feature.properties[attribute] != null) {
        const v = Number(layer.feature.properties[attribute]);
        if (Number.isFinite(v) && v > 0) values.push(v);
      }
    });
    minValue = Math.min(...values);

    map.eachLayer(function (layer) {
      if (layer.feature && layer.feature.properties && layer.feature.properties[attribute] != null) {
        const props = layer.feature.properties;

        const attValue = Number(props[attribute]);
        const radius = calcPropRadius(attValue);
        layer.setRadius(radius);

        const year = attribute.split("_")[1];
        let popupContent = `<p><b>MSA:</b> ${props.msa}</p>`;
        popupContent += `<p><b>Anchor city:</b> ${props.anchor_city}</p>`;
        popupContent += `<p><b>Population in ${year}:</b> ${Number(attValue).toLocaleString()}</p>`;

        const popup = layer.getPopup();
        popup.setContent(popupContent);

        popup.options.offset = new L.Point(0, -radius);
        popup.update();
      }
    });
    updateLegend(attribute);
    updateSymbolLegend(attribute);
  }

    // load data
  function getData() {
  fetch("data/cities.geojson")
    .then((response) => response.json())
    .then((json) => {
      const attributes = processData(json);
      createSequenceControls(attributes);
      createSymbolLegend();
      createPropSymbols(json, attributes);
    })
    .catch((err) => console.error("Failed to load GeoJSON:", err));
}
  
  document.addEventListener("DOMContentLoaded", createMap);
