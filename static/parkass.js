/**

**/

var map;
var polylines = [];
var drawingManager;
var placeIdArray = [];
var snappedCoordinates = [];
var strokeWeight = 1;

function initMap() {
  var street_name;
  path = decodeURIComponent(window.location.pathname)
  path = path.split("/")
  if (path.length > 5) {
    country = path[2]
    province = path[3]
    city = path[4]
    street_name = path[5]

    coords = getCoordsByAddress(country, province, city, street_name)
    loadMap(coords.geometry.location)
    
  }
  else {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(getCoordsFromBrowser);
    } else {
      console.log("Geolocation is not supported by this browser.");
    }
  } 

  parkingData = getParkingData(country, province, city, street_name)
  $(parkingData).each(function(a,b){
    if(b.between && b.between[0] && b.between[1]) {
	pointA = getCoordsByIntersection(country, province, city, street_name, b.between[0])
	pointB = getCoordsByIntersection(country, province, city, street_name, b.between[1])
	latlngA = pointA.geometry.location.lat + "," + pointA.geometry.location.lng
	latlngB = pointB.geometry.location.lat + "," + pointB.geometry.location.lng
	console.log(street_name, b.between[0],latlngA)
	console.log(street_name, b.between[1],latlngB)
	if(b.parking && !b.period) {
		color = "#52ff00"
		html = "<li style='color: "+color+"'>" + street_name + " ("+ b.side +") '" + b.between[0] +"' and '"+ b.between[1] + "' until '"+b.nextTime+" on "+ b.nextDay +"'</li>"
	} 
	else if(b.parking && b.period) {
		color = "#52ff00"
		html = "<li style='color: "+color+"'>" + street_name + " ("+ b.side +") '" + b.between[0] +"' and '"+ b.between[1] + "' for '"+ b.period +"'</li>"
	}
	else if(!b.parking && b.period) {
		color = "orange"
		html = "<li style='color: "+color+"'>" + street_name + " ("+ b.side +") '" + b.between[0] +"' and '"+ b.between[1] + "' for '"+ b.period +"'</li>"
	}
	else if(!b.parking && !b.nextTime)
	{
		color = "#ff0000"
		html = "<li style='color: "+color+"'>" + street_name + " ("+ b.side +") '" + b.between[0] +"' and '"+ b.between[1] + "' ever</li>"
	}
	else if(!b.parking && b.nextTime)
	{
		color = "#ff0000"
		html = "<li style='color: "+color+"'>" + street_name + " ("+ b.side +") '" + b.between[0] +"' and '"+ b.between[1] + "' until '"+b.nextTime+" on "+b.nextDay+"'</li>"
	}
	else {
		color = "pink"
		html = "<li style='color: "+color+"'>" + street_name + " ("+ b.side +") '" + b.between[0] +"' and '"+ b.between[1] + "' for '"+ b.period +"'</li>"
	}

	setRoadOverlay(latlngA,latlngB, color)
	$("#restrictionsUL").append(html)
    }
    
  });
}
function saveCoords(street,locationpoint,coords){
    url = "/api/v1/data/saveCoords"
    var data = {
	street: street, 
	locationpoint: locationpoint, 
	coords: coords 
    }
    $.post(url,data)
}
/**

**/
function getCoordsFromBrowser(position){
    latlng = getLatLongObj(position.coords.latitude, position.coords.longitude)
    loadMap(latlng)
}
/**

**/
function loadMap(latlng) {
  var infowindow = new google.maps.InfoWindow;

  if(latlng === false){
    map = new google.maps.Map(document.getElementById('map'), {
      center: {lat: 40.0, lng: -73.0},
      zoom: 18
    });
    
  }
  else
  {
    map = new google.maps.Map(document.getElementById('map'), {
      center: latlng, 
      zoom: 18
    });
    setMarker(map, latlng) 
  } 
}
/**

**/
function getAddressComponent(components, value) {
    var a = "";
    $(components).each(function(i,v){
        if($.inArray(value, v.types) !== -1) {
            a = v.long_name
            return a
        }
    });
}
/**

**/
function constructParkingDataURL(country, province, city, street_name) {
    url_base = ""
    url_view = "/passman/"
    url_api = "/api/v1/data/"
    url_data = country + "/" + province +  "/" + city + "/" + street_name

    url_view = url_base + url_view + url_data
    url_api = url_base + url_api + url_data

    return url_api
}
/**
        country = getAddressComponent(results[0].address_components,'country')
        province = getAddressComponent(results[0].address_components,'administrative_area_level_1')
        city = getAddressComponent(results[0].address_components,'locality')
        street_name = getAddressComponent(results[0].address_components,'street_address')
        if($(street_name).length === 0){
            street_name = getAddressComponent(results[0].address_components,'route')
        }

        getParkingData(country, province, city, street_name)
**/
function getParkingData(country, province, city, street_name) {
    url_api = constructParkingDataURL(country, province, city, street_name)
    parkingData = $.ajax({url:url_api,async: false}).done(function(data){
	if(!data) {
	    console.log("EEEERRRRRRROOOOOORRRRRR")
	}
	return data
    });
    return parkingData.responseJSON
}
/**

**/
function setRoadOverlay(latlngA, latlngB, color) {
    $.get('https://roads.googleapis.com/v1/snapToRoads', {
    	interpolate: true,
    	key: "AIzaSyCd_C2QUf4mKtr9J0e016pm_YpCGzECWPY",
	path: latlngA + "|" + latlngB
    }, function(data) {
  	processSnapToRoadResponse(data);
	drawSnappedPolyline(color);
    });
}
// Store snapped polyline returned by the snap-to-road service.
function processSnapToRoadResponse(data) {
  snappedCoordinates = [];
  placeIdArray = [];
  for (var i = 0; i < data.snappedPoints.length; i++) {
    var latlng = new google.maps.LatLng(
        data.snappedPoints[i].location.latitude,
        data.snappedPoints[i].location.longitude);
    snappedCoordinates.push(latlng);
    placeIdArray.push(data.snappedPoints[i].placeId);
  }
}
// Draws the snapped polyline (after processing snap-to-road response).
function drawSnappedPolyline(color) {
  var snappedPolyline = new google.maps.Polyline({
    path: snappedCoordinates,
    strokeColor: color,
    strokeWeight: 10
  });
  strokeWeight += 1

  snappedPolyline.setMap(map);
  polylines.push(snappedPolyline);
}
function getColor(){
	r = Math.floor((Math.random() * 10000000) + 1)
	h = r.toString(16).toUpperCase()
	return "#" + h
}
/**

**/
function getLatLongObj(lat,lng) {
  return {lat: parseFloat(lat), lng: parseFloat(lng)};
}
/**

**/
function getAddressByCoords(lat,lng) {
  var geocoder = new google.maps.Geocoder;
  var latlng = getLatLongObj(lat,lng) 
  geocoder.geocode({'location': latlng}, function(results, status) {
    if (status === 'OK') {
      if (results[0]) {
        return results[0]
      }
      else 
      {
        return false
      }
    }
  });
}
/**

**/
function getCoordsByIntersection(contry, province, city, street_name_1, street_name_2){
    street_name = street_name_1 + " and " + street_name_2
    street_name_1 = ""
    street_name_2 = ""
    return getCoordsByAddress(country, province, city, street_name)
}

function getCoordsByAddress(country, province, city, street_name) {
  selected_location = country + "+" + province + "+" + city + "+" + street_name
  url = "https://maps.googleapis.com/maps/api/geocode/json?address=" + selected_location + "&key=AIzaSyCd_C2QUf4mKtr9J0e016pm_YpCGzECWPY"
  a = $.ajax({
    url: url,
    async: false
  }).done(function(r){
    if(!r.results[0]){
      console.log("ERRRRRORRR")
      return r.results[0]
    }
  })
  return a.responseJSON.results[0]
}
/**

**/
function setMarker(map, lat, lng) {
  result = getAddressByCoords(lat,lng)
  if(result === false)
  {
    console.log("Coords not found")
  }
  else
  {
    var marker = new google.maps.Marker({
      position: getLatLongObj(lat,lng),
      map: map
    });
    return marker
  }

}
