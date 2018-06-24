import xml.etree.ElementTree as ET
import time

class ParkingNotAllowed:
    def __init__(self, side, between, time):
        self.side = side
        self.between = between.replace("\u00a0"," ").split(" and ")
        self.time = time
            

class ParkingRestriction:
    def __init__(self, side, between, time, period):
        self.side = side
        self.between = between.replace("\u00a0"," ").split(" and ")
        self.time = time
        self.period = period

class Parkass:
    def __init__(self, app):
        self.app = app
        self.logger = app.logger
        self.noparkingdict = {}
        self.parkingrestdict = {}
        self.makeDicts()
        
    def getData(self, lat, lng):
        return 'latitude ' + lat + ', longitude ' + lng

    def makeDicts(self):
        noparking = ET.parse('data/Ch_950_Sch_13_NoParking.xml').getroot()
        restricted = ET.parse('data/Ch_950_Sch_15_ParkingForRestrictedPeriods.xml').getroot()
        
        for child in noparking:

            try:
                h = child.find('Highway').text
                if h not in self.noparkingdict.keys():
                    self.noparkingdict[h] = []
                self.noparkingdict[h].append(ParkingNotAllowed(child.find('Side').text, child.find('Between').text, child.find('Prohibited_Times_and_or_Days').text))
            except Exception as e:
                self.logger.warning("Error: %s" % e)
        
        for child in restricted:
            try:
                h = child.find('Highway').text
                if h not in self.parkingrestdict.keys():
                    self.parkingrestdict[h] = []
                self.parkingrestdict[h].append(ParkingRestriction(child.find('Side').text, child.find('Between').text, child.find('Times_and_or_Days').text, child.find('Maximum_Period_Permitted').text))
            except Exception as e:
                self.logger.warning("Error: %s" % e)
        return 

    def getData(self, street):
        if street not in self.noparkingdict.keys() and street not in self.parkingrestdict.keys():
            return 1
        i = []
        
        # Separating dates and times
        if street in self.noparkingdict.keys():
            for j in self.noparkingdict[street]:
                d = j.__dict__
                times = d["time"].split("; ")
                times[0] = times[0].split(", ")
                for k in range(0,len(times[0])):
                    x = times[0][k].split(' to ')
                    if x[0][0] == 'M' or x[0][0] == 'T' or x[0][0] == 'W' or x[0][0] == 'F' or x[0][0] == 'S':
                        d["days"] = x
                    elif x[0][0].isdigit():
                        times[0][k] = x
                    else:
                        d["other"] = x
                if len(times) == 1:
                    times = times[0]
                times = list(filter(lambda x: type(x) is list, times))
                d["times"] = times
                i.append(d)
        
        if street in self.parkingrestdict.keys():
            for j in self.parkingrestdict[street]:
                d = j.__dict__
                times = d["time"].split("; ")
                times[0] = times[0].split(", ")
                for k in range(0,len(times[0])):
                    x = times[0][k].split(' to ')
                    if x[0][0] == 'M' or x[0][0] == 'T' or x[0][0] == 'W' or x[0][0] == 'F' or x[0][0] == 'S':
                        d["days"] = x
                    elif x[0][0].isdigit():
                        times[0][k] = x
                    else:
                        d["other"] = x
                if len(times) == 1:
                    times = times[0]
                times = list(filter(lambda x: type(x) is list, times))
                d["times"] = times
                i.append(d)
        return i

    def getParking(self, country, province, city, street):
        data = self.getData(street)
        output = []
        days = {"Mon." : 0, "Tue." : 1, "Wed." : 2, "Thu." : 3, "Fri." : 4, "Sat." : 5, "Sun." : 6}
        
        # if street doesn't exist in the list of restrictions
        if data == 1:
            output.append({"Anywhere" : True})
            return output
        a = 0
        for area in data:
            temp = {}
            indays = False
            inhours = False
            inmins = False
            intersection = True
            if "between" in area.keys():
                temp["between"] = area["between"]
                # TEMPORARY if area is not between 2 intersections
                if len(temp["between"]) == 1:
                    intersection = False
                elif temp["between"][0][1] == ' ' or temp["between"][1][1] == ' ':
                    intersection = False
            if "side" in area.keys():
                temp["side"] = area["side"]
            if "period" in area.keys():
                temp["period"] = area["period"]
            # If parking is not allowed anytime or if it's some other weird restriction
            if area["time"][0] == 'A' or area["time"][0] == 'E':
                temp["parking"] = False
                if intersection:
                    output.append(temp)
                continue
            localtime = time.localtime(time.time())
            if "days" in area.keys():
                if len(area["days"]) >= 2:
                    if area["days"][0] in days.keys() and area["days"][1] in days.keys():
                        if days[area["days"][0]] <= localtime.tm_wday and localtime.tm_wday < days[area["days"][1]]:
                            indays = True
            #convert times into integers for hours and minutes        
            if "times" in area.keys():
                for times in area["times"]:
                    self.logger.warning(times)
                    try:
                        if type(times[0]) is list:
                            times[1] = times[0][1]
                            times[0] = times[0][0]
                        if times[0][1] == ':':
                            starthour = int(times[0][0])
                            startmin = int(times[0][2:4])
                        else:
                            starthour = int(times[0][0:2])
                            startmin = int(times[0][3:5])
                        if times[0][-4] == 'p':
                            starthour = int(starthour) + 12
                        if times[1][1] == ':':
                            endhour = int(times[1][0])
                            endmin = int(times[1][2:4])
                        else:
                            endhour = int(times[1][0:2])
                            endmin = int(times[1][3:5])
                        if times[1][-4] == 'p':
                            endhour = int(endhour) + 12
                    except Exception as e:
                        self.logger.warning("Error %s" % e)
            if starthour <= localtime.tm_hour and localtime.tm_hour < endhour:
                inhours = True
            if localtime.tm_hour == endhour and localtime.tm_min < endmin:
                inmins = True
            if endmin == 0:
                endmin = '00'
            if startmin == 0:
                startmin = '00'
            if indays and (inhours or inmins):
                temp["parking"] = False
                temp["nextTime"] = str(endhour) + ':' + str(endmin)
                if intersection:
                    output.append(temp)
            else:
                temp["parking"] = True
                temp["nextTime"] = str(starthour) + ':' + str(startmin)
                if "days" in area.keys():
                    temp["nextDay"] = area["days"][0]
                if intersection:
                    output.append(temp)
        return output

            
