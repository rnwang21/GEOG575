(function () {

    // This array lists every attribute the user can switch to in the coordinated views.
    var attrArray = ["renterRate", "popDensity", "POPULATION", "HOUSEHOLDS", "SQMI"];

    // This variable stores the attribute currently being visualized.
    var expressed = attrArray[0];

    // These variables define the overall size of the map SVG.
    var mapWidth = window.innerWidth * 0.62,
        mapHeight = 620;

    // These variables define the chart frame and its inner plotting area.
    var chartWidth = window.innerWidth * 0.33,
        chartHeight = 500,
        leftPadding = 58,
        rightPadding = 20,
        topPadding = 72,
        bottomPadding = 52,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topPadding - bottomPadding,
        chartTranslate = "translate(" + leftPadding + "," + topPadding + ")";

    // These references are reused by several functions after the page is built.
    var mapSvg, mapGroup, projection, path, zoomBehavior;
    var chartSvg;

    // These globals store loaded data and current scales so that updates can reuse them.
    var csvDataGlobal = null;
    var laRegionsGlobal = null;
    var colorScaleGlobal = null;
    var binsGlobal = null;
    var xScaleGlobal = null;
    var yScaleGlobal = null;

    // This starts the application once the page finishes loading.
    window.onload = setPage;

    // This function creates the page structure before any data are drawn.
    function setPage() {
        d3.select("body")
            .append("h1")
            .attr("class", "pageTitle")
            .text("Los Angeles Block Groups");

        d3.select("body")
            .append("div")
            .attr("class", "pageDescription")
            .html(
                "Explore how selected socioeconomic attributes vary across Los Angeles block groups. " +
                "Use the menu to switch variables, zoom the map to inspect small units, and hover over either view " +
                "to compare spatial patterns with the attribute distribution."
            );

        d3.select("body")
            .append("div")
            .attr("class", "metaNote")
            .html(
                "<b>Current metric:</b> " + getAttributeLabel(expressed) +
                " &nbsp;|&nbsp; <b>Data fields:</b> FIPS, population, households, renter occupancy, square miles" +
                " &nbsp;|&nbsp; <b>Derived fields:</b> renterRate = RENTER_OCC / HOUSEHOLDS; popDensity = POPULATION / SQMI"
            );

        // This builds the dropdown and reset button used for interaction.
        createControls();

        // This creates the base SVG container that will hold the map.
        createMap();

        // This adds the floating info box used for retrieve interactions.
        createInfoLabel();

        // This loads the CSV and TopoJSON and then triggers the visualization workflow.
        loadData();
    }

    // This function creates the page controls used for reexpress and map reset.
    function createControls() {
        var controls = d3.select("body")
            .append("div")
            .attr("class", "controls");

        controls.append("label")
            .attr("class", "controlLabel")
            .attr("for", "attributeDropdown")
            .text("Attribute");

        // This dropdown lets the user switch the currently expressed variable.
        controls.append("select")
            .attr("id", "attributeDropdown")
            .attr("class", "dropdown")
            .on("change", function () {
                changeAttribute(this.value);
            })
            .selectAll("option")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function (d) { return d; })
            .property("selected", function (d) { return d === expressed; })
            .text(function (d) { return getAttributeLabel(d); });

        // This button restores the map to its default zoom state.
        controls.append("button")
            .attr("class", "resetZoomBtn")
            .text("Reset Zoom")
            .on("click", function () {
                if (mapSvg && zoomBehavior) {
                    mapSvg.transition()
                        .duration(750)
                        .call(zoomBehavior.transform, d3.zoomIdentity);
                }
            });
    }

    // This function loads external data and starts the drawing process.
    function loadData() {
        Promise.all([
            d3.csv("data/la_data.csv"),
            d3.json("data/la_bg_geometry.topojson")
        ]).then(function (data) {
            var csvData = data[0];
            var topoData = data[1];

            // This extracts the first object layer from the TopoJSON file.
            var objectName = Object.keys(topoData.objects)[0];

            // This converts TopoJSON geometry into a GeoJSON features array.
            var laRegions = topojson.feature(topoData, topoData.objects[objectName]).features;

            // This fits the projected data tightly into the map SVG with a small margin.
            projection.fitExtent(
                [[8, 8], [mapWidth - 8, mapHeight - 8]],
                {
                    type: "FeatureCollection",
                    features: laRegions
                }
            );

            // This transfers CSV attributes into the GeoJSON properties using FIPS as the key.
            laRegions = joinData(laRegions, csvData);

            // These assignments store the prepared data for later updates and interactions.
            csvDataGlobal = csvData;
            laRegionsGlobal = laRegions;
            colorScaleGlobal = makeColorScale(csvDataGlobal);

            // This draws the supporting map layers and both coordinated views.
            setGraticule();
            setEnumerationUnits();
            setChart();
            createLegend();
            setZoom();
        });
    }

    // This function creates the SVG and group that will hold all map layers.
    function createMap() {
        mapSvg = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", mapWidth)
            .attr("height", mapHeight);

        // This group is transformed during zoom so that all layers move together.
        mapGroup = mapSvg.append("g")
            .attr("class", "mapGroup");

        // This projection is fitted to the Los Angeles geometry after the data load.
        projection = d3.geoMercator();

        // This path generator converts projected GeoJSON features into SVG paths.
        path = d3.geoPath().projection(projection);
    }

    // This function attaches zoom and pan behavior to the map SVG.
    function setZoom() {
        zoomBehavior = d3.zoom()
            .scaleExtent([1, 12])
            .on("zoom", function (event) {
                mapGroup.attr("transform", event.transform);

                // This keeps linework visually balanced as the user zooms in and out.
                var k = event.transform.k;
                d3.selectAll(".regions")
                    .style("stroke-width", (0.18 / k) + "px");

                d3.selectAll(".gratLines")
                    .style("stroke-width", (0.3 / k) + "px");
            });

        mapSvg.call(zoomBehavior);
    }

    // This function adds a graticule background to provide geographic reference.
    function setGraticule() {
        var graticule = d3.geoGraticule().step([0.1, 0.1]);

        mapGroup.append("path")
            .datum(graticule.outline())
            .attr("class", "gratBackground")
            .attr("d", path);

        mapGroup.selectAll(".gratLines")
            .data(graticule.lines())
            .enter()
            .append("path")
            .attr("class", "gratLines")
            .attr("d", path);
    }

    // This function joins the CSV table to the GeoJSON features by shared FIPS code.
    function joinData(laRegions, csvData) {
        var csvIndex = {};

        // This builds a lookup table and parses all numeric attributes once up front.
        csvData.forEach(function (row) {
            csvIndex[row.FIPS] = row;

            attrArray.forEach(function (attr) {
                var val = parseFloat(row[attr]);
                row[attr] = isNaN(val) ? null : val;
            });
        });

        // This copies matched CSV attributes into each feature's properties object.
        laRegions.forEach(function (feature) {
            var props = feature.properties;
            var row = csvIndex[props.FIPS];

            if (row) {
                attrArray.forEach(function (attr) {
                    props[attr] = row[attr];
                });
            }
        });

        return laRegions;
    }

    // This function creates a classed quantile color scale for the currently expressed variable.
    function makeColorScale(data) {
        var colorClasses = [
            "#feedde",
            "#fdbe85",
            "#fd8d3c",
            "#e6550d",
            "#a63603"
        ];

        var colorScale = d3.scaleQuantile()
            .range(colorClasses);

        // This extracts the current attribute values and uses them as the scale domain.
        var domainArray = data
            .map(function (d) { return d[expressed]; })
            .filter(function (v) { return v != null && !isNaN(v); });

        colorScale.domain(domainArray);
        return colorScale;
    }

    // This function returns the correct fill color for a feature or gray if data are missing.
    function choropleth(props, colorScale) {
        var val = props[expressed];
        return (val != null && !isNaN(val)) ? colorScale(val) : "#ccc";
    }

    // This function draws the choropleth polygons and adds linked retrieve interactions.
    function setEnumerationUnits() {
        var regions = mapGroup.selectAll(".regions")
            .data(laRegionsGlobal)
            .enter()
            .append("path")
            .attr("class", function (d) {
                return "regions region-" + cssSafe(d.properties.FIPS);
            })
            .attr("d", path)
            .style("fill", function (d) {
                return choropleth(d.properties, colorScaleGlobal);
            });

        // This stores the default style so the element can be restored after highlighting.
        regions.append("desc")
            .text('{"stroke":"#000","stroke-width":"0.18px","opacity":"1"}');

        // These listeners coordinate map hover with the histogram and info label.
        regions
            .on("mouseover", function (event, d) {
                highlightFeature(d.properties.FIPS);
                highlightMapToHistogram(d.properties[expressed]);
                setLabel(event, d.properties);
            })
            .on("mousemove", function (event) {
                moveLabel(event);
            })
            .on("mouseout", function (event, d) {
                dehighlightFeature(d.properties.FIPS);
                clearHistogramHighlight();
                hideLabel();
            });
    }

    // This function creates the histogram and updates it whenever the attribute changes.
    function setChart() {
        if (chartSvg) chartSvg.remove();

        chartSvg = d3.select("body")
            .append("svg")
            .attr("class", "chart")
            .attr("width", chartWidth)
            .attr("height", chartHeight);

        chartSvg.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", chartTranslate);

        // This extracts only valid values of the currently expressed attribute.
        var values = csvDataGlobal
            .map(function (d) { return d[expressed]; })
            .filter(function (v) { return v != null && !isNaN(v); });

        // This x-scale places histogram bins along the horizontal axis.
        xScaleGlobal = d3.scaleLinear()
            .domain(d3.extent(values))
            .nice()
            .range([0, chartInnerWidth]);

        // This histogram generator bins the values into 30 intervals.
        var histogram = d3.bin()
            .domain(xScaleGlobal.domain())
            .thresholds(30);

        binsGlobal = histogram(values);

        var maxCount = d3.max(binsGlobal, function (d) { return d.length; });

        // This switches to log y for all variables except renterRate.
        var useLogY = expressed !== "renterRate";

        yScaleGlobal = useLogY
            ? d3.scaleLog()
                .domain([1, maxCount])
                .range([chartInnerHeight, 0])
            : d3.scaleLinear()
                .domain([0, maxCount])
                .nice()
                .range([chartInnerHeight, 0]);

        var bars = chartSvg.selectAll(".bar")
            .data(binsGlobal)
            .enter()
            .append("rect")
            .attr("class", function (d, i) {
                return "bar bin-" + i;
            })
            .attr("x", function (d) {
                return leftPadding + xScaleGlobal(d.x0) + 1;
            })
            .attr("y", function (d) {
                var count = useLogY ? Math.max(1, d.length) : d.length;
                return topPadding + yScaleGlobal(count);
            })
            .attr("width", function (d) {
                return Math.max(0, xScaleGlobal(d.x1) - xScaleGlobal(d.x0) - 1);
            })
            .attr("height", function (d) {
                var count = useLogY ? Math.max(1, d.length) : d.length;
                return chartInnerHeight - yScaleGlobal(count);
            })
            .style("fill", function (d) {
                var mid = (d.x0 + d.x1) / 2;
                return colorScaleGlobal(mid);
            });

        // This stores the original bar style for later restoration after highlighting.
        bars.append("desc")
            .text('{"stroke":"none","stroke-width":"0px","opacity":"0.95"}');

        // These listeners coordinate histogram hover with the map and info label.
        bars
            .on("mouseover", function (event, d) {
                highlightBin(d);
                highlightHistogramToMap(d);
                setBinLabel(event, d);
            })
            .on("mousemove", function (event) {
                moveLabel(event);
            })
            .on("mouseout", function () {
                clearBinHighlight();
                clearMapFilterHighlight();
                hideLabel();
            });

        // This title updates automatically to match the current attribute.
        chartSvg.append("text")
            .attr("x", 20)
            .attr("y", 35)
            .attr("class", "chartTitle")
            .text("LA Block Groups: Histogram of " + getAttributeLabel(expressed));

        var xAxis = d3.axisBottom(xScaleGlobal);
        var yAxis = useLogY
            ? d3.axisLeft(yScaleGlobal).ticks(6, "~s")
            : d3.axisLeft(yScaleGlobal);

        // This draws the horizontal axis for attribute values.
        chartSvg.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(" + leftPadding + "," + (topPadding + chartInnerHeight) + ")")
            .call(xAxis);

        // This draws the vertical axis for bin counts.
        chartSvg.append("g")
            .attr("class", "axis")
            .attr("transform", chartTranslate)
            .call(yAxis);

        // This labels the x-axis with the currently expressed attribute name.
        chartSvg.append("text")
            .attr("class", "axisLabel")
            .attr("x", leftPadding + chartInnerWidth / 2)
            .attr("y", chartHeight - 6)
            .attr("text-anchor", "middle")
            .text(getAttributeLabel(expressed));

        // This labels the y-axis and notes whether the scale is logarithmic.
        chartSvg.append("text")
            .attr("class", "axisLabel")
            .attr("transform", "rotate(-90)")
            .attr("x", -(topPadding + chartInnerHeight / 2))
            .attr("y", 18)
            .attr("text-anchor", "middle")
            .text(useLogY ? "Count of Block Groups (log scale)" : "Count of Block Groups");

        // This draws a clean frame around the plotting area.
        chartSvg.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", chartTranslate);
    }

    // This function builds a dynamic legend that matches the current quantile breaks.
    function createLegend() {
        d3.select(".legendBox").remove();

        var legend = d3.select("body")
            .append("div")
            .attr("class", "legendBox");

        legend.append("div")
            .attr("class", "legendTitle")
            .text("Legend: " + getAttributeLabel(expressed));

        var thresholds = colorScaleGlobal.quantiles();
        var colors = colorScaleGlobal.range();

        // This reconstructs class boundaries from the quantile scale.
        var breaks = [d3.min(colorScaleGlobal.domain())]
            .concat(thresholds)
            .concat([d3.max(colorScaleGlobal.domain())]);

        var items = legend.selectAll(".legendItem")
            .data(colors)
            .enter()
            .append("div")
            .attr("class", "legendItem");

        items.append("span")
            .attr("class", "legendSwatch")
            .style("background-color", function (d) { return d; });

        items.append("span")
            .attr("class", "legendLabel")
            .text(function (d, i) {
                return formatLegendRange(breaks[i], breaks[i + 1]);
            });
    }

    // This helper simply rebuilds the legend after the user changes attributes.
    function updateLegend() {
        createLegend();
    }

    // This function handles reexpress by changing the active attribute and refreshing views.
    function changeAttribute(attribute) {
        expressed = attribute;
        colorScaleGlobal = makeColorScale(csvDataGlobal);

        d3.select(".metaNote")
            .html(
                "<b>Current metric:</b> " + getAttributeLabel(expressed) +
                " &nbsp;|&nbsp; <b>Data fields:</b> FIPS, population, households, renter occupancy, square miles" +
                " &nbsp;|&nbsp; <b>Derived fields:</b> renterRate = RENTER_OCC / HOUSEHOLDS; popDensity = POPULATION / SQMI"
            );

        // This smoothly recolors the map so the user can see the state change.
        d3.selectAll(".regions")
            .transition()
            .duration(900)
            .style("fill", function (d) {
                return choropleth(d.properties, colorScaleGlobal);
            });

        // This rebuilds the chart and legend to match the new variable.
        setChart();
        updateLegend();

        // This clears any temporary interaction state from the previous attribute.
        clearMapFilterHighlight();
        clearHistogramHighlight();
        hideLabel();
    }

    // This function highlights a single map feature when it is hovered.
    function highlightFeature(fips) {
        d3.selectAll(".region-" + cssSafe(fips))
            .style("stroke", "blue")
            .style("stroke-width", "1.3px");
    }

    // This function returns the map feature to its default appearance after hover ends.
    function dehighlightFeature(fips) {
        d3.selectAll(".region-" + cssSafe(fips))
            .style("stroke", "#000")
            .style("stroke-width", "0.18px");
    }

    // This function highlights a single histogram bin while fading the others.
    function highlightBin(bin) {
        d3.selectAll(".bar")
            .style("opacity", 0.28)
            .style("stroke", "none");

        d3.selectAll(".bar")
            .filter(function (d) { return d === bin; })
            .style("opacity", 1)
            .style("stroke", "blue")
            .style("stroke-width", "1.2px");
    }

    // This function restores all histogram bars to their default style.
    function clearBinHighlight() {
        d3.selectAll(".bar")
            .style("opacity", 0.95)
            .style("stroke", "none");
    }

    // This function highlights the matching histogram bin when the user hovers on the map.
    function highlightMapToHistogram(value) {
        if (value == null || isNaN(value) || !binsGlobal) return;

        d3.selectAll(".bar")
            .style("opacity", 0.25)
            .style("stroke", "none");

        d3.selectAll(".bar")
            .filter(function (d) {
                return inBin(value, d);
            })
            .style("opacity", 1)
            .style("stroke", "blue")
            .style("stroke-width", "1.2px");
    }

    // This function restores the histogram after a map-based highlight ends.
    function clearHistogramHighlight() {
        d3.selectAll(".bar")
            .style("opacity", 0.95)
            .style("stroke", "none");
    }

    // This function highlights map units whose values fall inside the hovered histogram bin.
    function highlightHistogramToMap(bin) {
        d3.selectAll(".regions")
            .style("opacity", function (d) {
                var val = d.properties[expressed];
                return inBin(val, bin) ? 1 : 0.18;
            });
    }

    // This function restores all map units after the histogram hover ends.
    function clearMapFilterHighlight() {
        d3.selectAll(".regions")
            .style("opacity", 1);
    }

    // This helper tests whether a value belongs to a particular histogram bin.
    function inBin(value, bin) {
        if (value == null || isNaN(value)) return false;
        if (value >= bin.x0 && value < bin.x1) return true;

        // This includes the maximum value in the final bin.
        var maxX = xScaleGlobal.domain()[1];
        if (value === maxX && bin.x1 === maxX) return true;

        return false;
    }

    // This function creates the floating label container used by retrieve interactions.
    function createInfoLabel() {
        d3.select(".infolabel").remove();

        d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .style("display", "none");
    }

    // This function fills the label with the selected map feature's information.
    function setLabel(event, props) {
        d3.select(".infolabel")
            .style("display", "block")
            .html(
                "<b>FIPS:</b> " + props.FIPS + "<br>" +
                "<b>" + getAttributeLabel(expressed) + ":</b> " + formatValue(props[expressed]) + "<br>" +
                "<b>Population:</b> " + formatMaybeInteger(props.POPULATION) + "<br>" +
                "<b>Households:</b> " + formatMaybeInteger(props.HOUSEHOLDS) + "<br>" +
                "<b>SQMI:</b> " + formatMaybeFixed(props.SQMI, 3)
            );

        moveLabel(event);
    }

    // This function fills the label with the selected histogram bin's summary information.
    function setBinLabel(event, bin) {
        d3.select(".infolabel")
            .style("display", "block")
            .html(
                "<b>Range:</b> " + formatLegendRange(bin.x0, bin.x1) + "<br>" +
                "<b>Block Groups:</b> " + d3.format(",")(bin.length)
            );

        moveLabel(event);
    }

    // This function repositions the floating label so it follows the pointer.
    function moveLabel(event) {
        var label = d3.select(".infolabel");
        var labelNode = label.node();
        if (!labelNode) return;

        var labelWidth = labelNode.getBoundingClientRect().width;

        var x1 = event.clientX + 14,
            y1 = event.clientY - 70,
            x2 = event.clientX - labelWidth - 14,
            y2 = event.clientY + 22;

        var x = event.clientX > window.innerWidth - labelWidth - 30 ? x2 : x1;
        var y = event.clientY < 80 ? y2 : y1;

        label
            .style("left", x + "px")
            .style("top", y + "px");
    }

    // This function hides the floating label whenever no element is selected.
    function hideLabel() {
        d3.select(".infolabel").style("display", "none");
    }

    // This helper returns a readable label for each attribute name.
    function getAttributeLabel(attr) {
        if (attr === "renterRate") return "Renter Rate";
        if (attr === "popDensity") return "Population Density";
        if (attr === "POPULATION") return "Population";
        if (attr === "HOUSEHOLDS") return "Households";
        if (attr === "SQMI") return "Area (SQMI)";
        return attr;
    }

    // This helper formats the current attribute for labels and tooltips.
    function formatValue(v) {
        if (v == null || isNaN(v)) return "N/A";
        if (expressed === "renterRate") return d3.format(".1%")(v);
        if (expressed === "popDensity") return d3.format(",.0f")(v);
        if (expressed === "SQMI") return d3.format(".3f")(v);
        return d3.format(",")(v);
    }

    // This helper formats legend class breaks according to the active attribute type.
    function formatLegendRange(a, b) {
        if (a == null || b == null || isNaN(a) || isNaN(b)) return "N/A";

        if (expressed === "renterRate") {
            return d3.format(".0%")(a) + " – " + d3.format(".0%")(b);
        }
        if (expressed === "popDensity") {
            return d3.format(",.0f")(a) + " – " + d3.format(",.0f")(b);
        }
        if (expressed === "SQMI") {
            return d3.format(".2f")(a) + " – " + d3.format(".2f")(b);
        }
        return d3.format(",")(a) + " – " + d3.format(",")(b);
    }

    // This helper formats integer-like values in the info label.
    function formatMaybeInteger(v) {
        return (v == null || isNaN(v)) ? "N/A" : d3.format(",")(v);
    }

    // This helper formats decimal values with a fixed number of places.
    function formatMaybeFixed(v, n) {
        return (v == null || isNaN(v)) ? "N/A" : d3.format("." + n + "f")(v);
    }

    // This helper escapes special characters so FIPS values are safe in CSS selectors.
    function cssSafe(str) {
        return String(str).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    }

})();