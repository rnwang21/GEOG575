// Data: an array of cities
var cityPop = [
	{ 
		city: 'Madison',
		population: 233209
	},
	{
		city: 'Milwaukee',
		population: 594833
	},
	{
		city: 'Green Bay',
		population: 104057
	},
	{
		city: 'Superior',
		population: 27244
	}
];

// Create the table

function createTable(cityPop) {
	var table = document.createElement("table");

	var headerRow = document.createElement("tr");
	headerRow.insertAdjacentHTML("beforeend", "<th>City</th>");
	headerRow.insertAdjacentHTML("beforeend", "<th>Population</th>");
	table.appendChild(headerRow);

	cityPop.forEach(function (item) {
	  var row = document.createElement("tr");
	  row.insertAdjacentHTML("beforeend", "<td>" + item.city + "</td>");
	  row.insertAdjacentHTML("beforeend", "<td>" + item.population + "</td>");
	  table.appendChild(row);
	});

	document.body.appendChild(table);
  }

// Add a "City Size" column to the existing table with size rules:
//    < 100,000 => Small
//    < 500,000 => Medium
//    else      => Large

function addColumns(cityPop){
    
    document.querySelectorAll("tr").forEach(function(row, i){

    	if (i == 0){

    		row.insertAdjacentHTML('beforeend', '<th>City Size</th>');
    	} else {

    		var citySize;

    		if (cityPop[i-1].population < 100000){
    			citySize = 'Small';

    		} else if (cityPop[i-1].population < 500000){

    			citySize = 'Medium';

    		} else {
    			citySize = 'Large';
    		};

			row.insertAdjacentHTML('beforeend', '<td>' + citySize + '</td>');
    	};
    });
};

// Add interactions:
//    - mouseover: randomize table background color
//    - click: alert message

function addEvents(){

	document.querySelector("table").addEventListener("mouseover", function(){
		
		var color = "rgb(";

		for (var i=0; i<3; i++){

			var random = Math.round(Math.random() * 255);

			color += random;

			if (i<2){
				color += ",";
			
			} else {
				color += ")";
		};
	}
		document.querySelector("table").style.backgroundColor = color;
	});

	document.querySelector("table").addEventListener("click", function () {
    alert('Hey, you clicked me!');
  });
}

// Called after GeoJSON is fetched & parsed
function debugCallback(myData){
	// display the loaded GeoJSON data
	document.querySelector("#mydiv").insertAdjacentHTML(
		'beforeend',
		'<br>GeoJSON data:<br>' + JSON.stringify(myData)
	);
};

function debugAjax(){
	
	fetch("data/MegaCities.geojson")
		.then(function(response){
			// convert the HTTP response into JSON
			return response.json();
		})
		.then(function(myData){
			// pass the actual data to the callback
			debugCallback(myData);
		}).catch(function(err){
			console.log("GeoJSON fetch error:", err);
			document.querySelector("#mydiv").insertAdjacentHTML(
				"beforeend",
				"<br><strong>ERROR:</strong> " + err
			);
		});
};

document.addEventListener("DOMContentLoaded", function () {
	createTable(cityPop);
	addColumns(cityPop);
	addEvents();
  
	debugAjax();
  });