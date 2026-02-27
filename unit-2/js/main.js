let map;
let minValue;

//instantiate the Leaflet map
function createMap() {
    console.log("URL:", location.href);
    console.log("panel?", document.querySelector("#panel"));
    // create the map
    map = L.map("map", {
      center: [20, 0],
      zoom: 2,
      preferCanvas: true,
    });
  
    // add tile layer
    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
          // subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);
    
      getData();
    }

    function processData(data) {
    return ["population_2021", "gdp_million_usd_2021", "gdp_per_capita_usd_2021"];
  }
  
  function calcMinValue(data, attribute) {
    let values = [];
    data.features.forEach((feature) => {
      const v = Number(feature.properties[attribute]);
      if (Number.isFinite(v) && v > 0) values.push(v);
    });
    return Math.min(...values);
  }

  function calcPropRadius(attValue) {
    const minRadius = 4;
    return 1.0083 * Math.pow(attValue / minValue, 0.5715) * minRadius;
  }

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
    let popupContent = `<p><b>MSA:</b> ${props.msa}</p>`;
    popupContent += `<p><b>Anchor city:</b> ${props.anchor_city}</p>`;
    popupContent += `<p><b>${attribute}:</b> ${Number(attValue).toLocaleString()}</p>`;

    // bind popup with offset (so it doesn't cover the circle)
    layer.bindPopup(popupContent, {
      offset: new L.Point(0, -options.radius),
    });

    return layer;
  }

  function createPropSymbols(data, attributes) {
    const attribute = attributes[0];
    minValue = calcMinValue(data, attribute);

    const geoLayer = L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        return pointToLayer(feature, latlng, attribute);
      },
    }).addTo(map);

    map.fitBounds(geoLayer.getBounds(), {
      padding: [20, 20],
      maxZoom: 10,
    });
  }

  // create slider + step buttons
  function createSequenceControls(attributes) {
    let panel = document.querySelector("#panel");
    if (!panel) {
      console.error("No #panel found in DOM.");
      return;
    }
    // create slider
    const slider = "<input class='range-slider' type='range'></input>";
    document.querySelector("#panel").insertAdjacentHTML("beforeend", slider);

    // slider attributes
    document.querySelector(".range-slider").max = attributes.length - 1;
    document.querySelector(".range-slider").min = 0;
    document.querySelector(".range-slider").value = 0;
    document.querySelector(".range-slider").step = 1;

    // step buttons
    document.querySelector("#panel").insertAdjacentHTML(
      "beforeend",
      '<button class="step" id="reverse">Reverse</button>'
    );
    document.querySelector("#panel").insertAdjacentHTML(
      "beforeend",
      '<button class="step" id="forward">Forward</button>'
    );

    document.querySelectorAll(".step").forEach(function (step) {
      step.addEventListener("click", function () {
        let index = Number(document.querySelector(".range-slider").value);

        // increment/decrement + wrap around
        if (step.id === "forward") {
          index++;
          index = index > attributes.length - 1 ? 0 : index;
        } else if (step.id === "reverse") {
          index--;
          index = index < 0 ? attributes.length - 1 : index;
        }

        document.querySelector(".range-slider").value = index;

        updatePropSymbols(attributes[index], attributes);
      });
    });

    document.querySelector(".range-slider").addEventListener("input", function () {
      const index = Number(this.value);
      updatePropSymbols(attributes[index], attributes);
    });
  }

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

        let popupContent = `<p><b>MSA:</b> ${props.msa}</p>`;
        popupContent += `<p><b>Anchor city:</b> ${props.anchor_city}</p>`;
        popupContent += `<p><b>${attribute}:</b> ${Number(attValue).toLocaleString()}</p>`;

        const popup = layer.getPopup();
        popup.setContent(popupContent);

        popup.options.offset = new L.Point(0, -radius);
        popup.update();
      }
    });
  }

    // load data
  function getData() {
    fetch("data/cities.geojson")
      .then((response) => response.json())
      .then((json) => {
        const attributes = processData(json);
        createPropSymbols(json, attributes);
        createSequenceControls(attributes);
      })
      .catch((err) => console.error("Failed to load GeoJSON:", err));
  }
  
  document.addEventListener("DOMContentLoaded", createMap);
