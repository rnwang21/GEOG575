//execute script when window is loaded
window.onload = function(){

    //SVG dimension variables
    var w = 900, h = 500;

    //city population data
    var cityPop = [
        {
            city: "Madison",
            population: 233209
        },
        {
            city: "Milwaukee",
            population: 594833
        },
        {
            city: "Green Bay",
            population: 104057
        },
        {
            city: "Superior",
            population: 27244
        }
    ];

    //create the SVG container
    var container = d3.select("body")
        .append("svg")
        .attr("width", w)
        .attr("height", h)
        .attr("class", "container");

    //create inner rectangle
    var innerRect = container.append("rect")
        .datum(400)
        .attr("width", function(d){
            return d * 2;
        })
        .attr("height", function(d){
            return d;
        })
        .attr("class", "innerRect")
        .attr("x", 50)
        .attr("y", 50)
        .style("fill", "#FFFFFF");

    //create x scale
    var x = d3.scaleLinear()
        .range([90, 750])
        .domain([0, 3]);

    //find minimum population
    var minPop = d3.min(cityPop, function(d){
        return d.population;
    });

    //find maximum population
    var maxPop = d3.max(cityPop, function(d){
        return d.population;
    });

    //create y scale
    var y = d3.scaleLinear()
        .range([450, 50])
        .domain([0, 700000]);

    //create color scale
    var color = d3.scaleLinear()
        .range([
            "#FDBE85",
            "#D94701"
        ])
        .domain([
            minPop,
            maxPop
        ]);

    //create circles
    var circles = container.selectAll(".circles")
        .data(cityPop)
        .enter()
        .append("circle")
        .attr("class", "circles")
        .attr("id", function(d){
            return d.city.replace(/\s+/g, "");
        })
        .attr("r", function(d){
            var area = d.population * 0.01;
            return Math.sqrt(area / Math.PI);
        })
        .attr("cx", function(d, i){
            return x(i);
        })
        .attr("cy", function(d){
            return y(d.population);
        })
        .style("fill", function(d){
            return color(d.population);
        })
        .style("stroke", "#000");

    //create y axis generator
    var yAxis = d3.axisLeft(y);

    //create axis group and place it
    var axis = container.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(50, 0)")
        .call(yAxis);

    //create chart title
    var title = container.append("text")
        .attr("class", "title")
        .attr("text-anchor", "middle")
        .attr("x", 450)
        .attr("y", 30)
        .text("City Populations");

    //create format generator
    var format = d3.format(",");

    //create labels
    var labels = container.selectAll(".labels")
        .data(cityPop)
        .enter()
        .append("text")
        .attr("class", "labels")
        .attr("text-anchor", "left")
        .attr("y", function(d){
            return y(d.population);
        });

    //create first line of labels
    var nameLine = labels.append("tspan")
        .attr("class", "nameLine")
        .attr("x", function(d, i){
            var radius = Math.sqrt(d.population * 0.01 / Math.PI);
            return x(i) + radius + 5;
        })
        .text(function(d){
            return d.city;
        });

    //create second line of labels
    var popLine = labels.append("tspan")
        .attr("class", "popLine")
        .attr("x", function(d, i){
            var radius = Math.sqrt(d.population * 0.01 / Math.PI);
            return x(i) + radius + 5;
        })
        .attr("dy", "15")
        .text(function(d){
            return "Pop. " + format(d.population);
        });

};