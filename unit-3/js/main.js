(function () {

    var attrArray = ["renterRate", "popDensity", "POPULATION", "HOUSEHOLDS", "SQMI"];
    var expressed = attrArray[0];

    window.onload = setMap;

    function setMap() {
        var width = window.innerWidth * 0.5,
            height = 460;

        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        var projection = d3.geoMercator();
        var path = d3.geoPath().projection(projection);

        var promises = [
            d3.csv("data/la_data.csv"),
            d3.json("data/la_bg_geometry.topojson")
        ];

        Promise.all(promises).then(callback);

        function callback(data) {
            var csvData = data[0];
            var topoData = data[1];

            var objectName = Object.keys(topoData.objects)[0];
            var laRegions = topojson.feature(topoData, topoData.objects[objectName]).features;

            projection.fitSize([width, height], {
                type: "FeatureCollection",
                features: laRegions
            });

            laRegions = joinData(laRegions, csvData);

            var colorScale = makeColorScale(csvData);

            setGraticule(map, path);
            setEnumerationUnits(laRegions, map, path, colorScale);
            setHistogram(csvData, colorScale);
        }
    }

    function setGraticule(map, path) {
        var graticule = d3.geoGraticule().step([0.1, 0.1]);

        map.append("path")
            .datum(graticule.outline())
            .attr("class", "gratBackground")
            .attr("d", path);

        map.selectAll(".gratLines")
            .data(graticule.lines())
            .enter()
            .append("path")
            .attr("class", "gratLines")
            .attr("d", path);
    }

    function joinData(laRegions, csvData) {
        var csvIndex = {};

        csvData.forEach(function (row) {
            csvIndex[row.FIPS] = row;
        });

        laRegions.forEach(function (feature) {
            var geoProps = feature.properties;
            var row = csvIndex[geoProps.FIPS];

            if (row) {
                attrArray.forEach(function (attr) {
                    var val = parseFloat(row[attr]);
                    geoProps[attr] = isNaN(val) ? null : val;
                });
            }
        });

        return laRegions;
    }

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

        var domainArray = data
            .map(function (d) {
                return parseFloat(d[expressed]);
            })
            .filter(function (v) {
                return !isNaN(v);
            });

        colorScale.domain(domainArray);
        return colorScale;
    }

    function choropleth(props, colorScale) {
        var val = props[expressed];
        if (val != null && !isNaN(val)) {
            return colorScale(val);
        } else {
            return "#ccc";
        }
    }

    function setEnumerationUnits(laRegions, map, path, colorScale) {
        map.selectAll(".regions")
            .data(laRegions)
            .enter()
            .append("path")
            .attr("class", function (d) {
                return "regions " + d.properties.FIPS;
            })
            .attr("d", path)
            .style("fill", function (d) {
                return choropleth(d.properties, colorScale);
            })
            .append("title")
            .text(function (d) {
                var p = d.properties;
                return "FIPS: " + p.FIPS +
                    "\nRenter rate: " + formatMaybePercent(p.renterRate) +
                    "\nPop density: " + formatMaybeNumber(p.popDensity) +
                    "\nPopulation: " + formatMaybeInteger(p.POPULATION) +
                    "\nHouseholds: " + formatMaybeInteger(p.HOUSEHOLDS) +
                    "\nSQMI: " + formatMaybeFixed(p.SQMI, 3);
            });
    }

    function setHistogram(csvData, colorScale) {
        var chartWidth = window.innerWidth * 0.425,
            chartHeight = 473,
            leftPadding = 45,
            rightPadding = 20,
            topPadding = 50,
            bottomPadding = 35,
            chartInnerWidth = chartWidth - leftPadding - rightPadding,
            chartInnerHeight = chartHeight - topPadding - bottomPadding,
            translate = "translate(" + leftPadding + "," + topPadding + ")";

        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        var values = csvData
            .map(function (d) { return parseFloat(d[expressed]); })
            .filter(function (v) { return !isNaN(v); });

        var xScale = d3.scaleLinear()
            .domain(d3.extent(values))
            .nice()
            .range([0, chartInnerWidth]);

        var histogram = d3.bin()
            .domain(xScale.domain())
            .thresholds(30);

        var bins = histogram(values);

        var yScale = d3.scaleLinear()
            .domain([0, d3.max(bins, function (d) { return d.length; })])
            .nice()
            .range([chartInnerHeight, 0]);

        chart.selectAll(".bar")
            .data(bins)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", function (d) {
                return leftPadding + xScale(d.x0) + 1;
            })
            .attr("y", function (d) {
                return topPadding + yScale(d.length);
            })
            .attr("width", function (d) {
                return Math.max(0, xScale(d.x1) - xScale(d.x0) - 1);
            })
            .attr("height", function (d) {
                return chartInnerHeight - yScale(d.length);
            })
            .style("fill", function (d) {
                var mid = (d.x0 + d.x1) / 2;
                return colorScale(mid);
            });

        chart.append("text")
            .attr("x", 20)
            .attr("y", 35)
            .attr("class", "chartTitle")
            .text(getChartTitle());

        var xAxis = d3.axisBottom(xScale);
        var yAxis = d3.axisLeft(yScale);

        chart.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(" + leftPadding + "," + (topPadding + chartInnerHeight) + ")")
            .call(xAxis);

        chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);

        chart.append("text")
            .attr("class", "axisLabel")
            .attr("x", leftPadding + chartInnerWidth / 2)
            .attr("y", chartHeight - 5)
            .attr("text-anchor", "middle")
            .text(getXAxisLabel());

        chart.append("text")
            .attr("class", "axisLabel")
            .attr("transform", "rotate(-90)")
            .attr("x", -(topPadding + chartInnerHeight / 2))
            .attr("y", 15)
            .attr("text-anchor", "middle")
            .text("Count of Block Groups");

        chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
    }

    function getChartTitle() {
        if (expressed === "renterRate") return "LA Block Groups: Histogram of Renter Rate";
        if (expressed === "popDensity") return "LA Block Groups: Histogram of Population Density";
        if (expressed === "POPULATION") return "LA Block Groups: Histogram of Population";
        if (expressed === "HOUSEHOLDS") return "LA Block Groups: Histogram of Households";
        if (expressed === "SQMI") return "LA Block Groups: Histogram of Area";
        return "LA Block Groups";
    }

    function getXAxisLabel() {
        if (expressed === "renterRate") return "Renter Rate";
        if (expressed === "popDensity") return "Population Density";
        if (expressed === "POPULATION") return "Population";
        if (expressed === "HOUSEHOLDS") return "Households";
        if (expressed === "SQMI") return "Area (SQMI)";
        return expressed;
    }

    function formatMaybePercent(v) {
        return (v == null || isNaN(v)) ? "N/A" : d3.format(".1%")(v);
    }

    function formatMaybeNumber(v) {
        return (v == null || isNaN(v)) ? "N/A" : d3.format(",.0f")(v);
    }

    function formatMaybeInteger(v) {
        return (v == null || isNaN(v)) ? "N/A" : d3.format(",")(v);
    }

    function formatMaybeFixed(v, n) {
        return (v == null || isNaN(v)) ? "N/A" : d3.format("." + n + "f")(v);
    }

})();