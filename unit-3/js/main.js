window.onload = setMap;

function setMap() {
    const width = 960;
    const height = 600;

    // create svg
    const map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    // group for zooming
    const g = map.append("g");

    // title
    map.append("text")
        .attr("class", "title")
        .attr("x", 20)
        .attr("y", 30)
        .text("Los Angeles Block Groups");

    map.append("text")
        .attr("class", "info")
        .attr("x", 20)
        .attr("y", 50)
        .text("Choropleth: Renter Occupancy Rate");

    // projection: let D3 fit it automatically to the data
    const projection = d3.geoMercator();

    // path generator
    const path = d3.geoPath()
        .projection(projection);

    // load topojson
    Promise.all([
        d3.json("data/la_bg.topojson")
    ]).then(function (data) {
        const laData = data[0];

        console.log("TopoJSON loaded:", laData);
        console.log("Available objects:", laData.objects);

        // automatically get object name
        const objectName = Object.keys(laData.objects)[0];
        const bgGeoJSON = topojson.feature(laData, laData.objects[objectName]);

        console.log("Using object:", objectName);
        console.log("Converted GeoJSON:", bgGeoJSON);
        console.log("Feature count:", bgGeoJSON.features.length);

        // fit projection to data
        projection.fitSize([width, height], bgGeoJSON);

        // graticule
        const graticule = d3.geoGraticule().step([0.1, 0.1]);

        g.append("path")
            .datum(graticule.outline())
            .attr("class", "gratBackground")
            .attr("d", path);

        g.selectAll(".gratLines")
            .data(graticule.lines())
            .enter()
            .append("path")
            .attr("class", "gratLines")
            .attr("d", path);

        // compute renter occupancy rate = RENTER_OCC / HOUSEHOLDS
        bgGeoJSON.features.forEach(function (d) {
            const households = +d.properties.HOUSEHOLDS;
            const renterOcc = +d.properties.RENTER_OCC;

            if (households > 0) {
                d.properties.renterRate = renterOcc / households;
            } else {
                d.properties.renterRate = null;
            }
        });

        // valid values only
        const values = bgGeoJSON.features
            .map(function (d) {
                return d.properties.renterRate;
            })
            .filter(function (v) {
                return v !== null && !isNaN(v);
            });

        const minVal = d3.min(values);
        const maxVal = d3.max(values);

        console.log("Min renter rate:", minVal);
        console.log("Max renter rate:", maxVal);

        // color scale
        const colorScale = d3.scaleSequential()
            .domain([minVal, maxVal])
            .interpolator(d3.interpolateOrRd);

        // draw polygons
        g.selectAll(".bg")
            .data(bgGeoJSON.features)
            .enter()
            .append("path")
            .attr("class", "bg")
            .attr("d", path)
            .style("fill", function (d) {
                const v = d.properties.renterRate;
                return (v !== null && !isNaN(v)) ? colorScale(v) : "#ccc";
            })
            .append("title")
            .text(function (d) {
                const rate = d.properties.renterRate;
                return "GlobalID: " + d.properties.GlobalID +
                    "\nHOUSEHOLDS: " + d.properties.HOUSEHOLDS +
                    "\nRENTER_OCC: " + d.properties.RENTER_OCC +
                    "\nRenter Occupancy Rate: " +
                    (rate !== null ? d3.format(".1%")(rate) : "N/A");
            });

        // legend
        const legendWidth = 220;
        const legendHeight = 12;
        const legendX = width - 260;
        const legendY = height - 45;

        const defs = map.append("defs");

        const linearGradient = defs.append("linearGradient")
            .attr("id", "legend-gradient")
            .attr("x1", "0%")
            .attr("x2", "100%")
            .attr("y1", "0%")
            .attr("y2", "0%");

        linearGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", colorScale(minVal));

        linearGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", colorScale(maxVal));

        map.append("text")
            .attr("class", "info")
            .attr("x", legendX)
            .attr("y", legendY - 8)
            .text("Renter Occupancy Rate");

        map.append("rect")
            .attr("x", legendX)
            .attr("y", legendY)
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#legend-gradient)")
            .style("stroke", "#666")
            .style("stroke-width", "0.5px");

        map.append("text")
            .attr("class", "info")
            .attr("x", legendX)
            .attr("y", legendY + 28)
            .text(d3.format(".0%")(minVal));

        map.append("text")
            .attr("class", "info")
            .attr("x", legendX + legendWidth)
            .attr("y", legendY + 28)
            .attr("text-anchor", "end")
            .text(d3.format(".0%")(maxVal));

    }).catch(function (error) {
        console.error("Error loading data:", error);
    });

    // zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", function (event) {
            g.attr("transform", event.transform);
        });

    map.call(zoom);
}