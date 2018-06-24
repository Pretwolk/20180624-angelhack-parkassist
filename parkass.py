#!/usr/bin/env python3

from flask import Flask, render_template, jsonify, request
import logging
from logging.handlers import RotatingFileHandler
from parkass import Parkass

app = Flask(__name__)

handler = RotatingFileHandler('data/parkass.log', maxBytes=100000000, backupCount=1)
#handler.setLevel(logging.INFO)
app.logger.addHandler(handler)

parkass = Parkass(app)

@app.route("/api/v1/data")
@app.route("/api/v1/data/<country>/<province>/<city>/<street>")
def getParkingData(country=None,province=None,city=None,street=None):
    parking = parkass.getParking(country,province,city,street)
    return jsonify(parking)

@app.route("/api/v1/data/saveCoords/", methods=["POST"])
def saveCoords():
    data = {}
    data['street'] = request.form.street
    data['locationpoint'] = request.form.locationpoint
    data['coords'] = request.form.coords
    app.logger.warning(data)
    parking = parkass.saveCoords(data)
    return parking

@app.route("/")
@app.route("/parkass")
@app.route("/parkass/<country>/<province>/<city>/<street>/")
def index(country=None, province=None, city=None, street=None):
    location = {}
    location['country'] = country
    location['province'] = province
    location['city'] = city
    location['street'] = street

    return render_template('maps.html', location=location)

@app.after_request
def set_response_headers(response):
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

app.run(debug=True)

