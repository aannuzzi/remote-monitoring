import urllib2
import random
from datetime import datetime, timedelta

def doRequest(urlReq):
	response = urllib2.urlopen('http://localhost:5000/data' + urlReq)
	html = response.read()
	print html

hrs = 24	# one day
interval = 15	# minutes

totalPoints = (60/interval * hrs)
print "total points:", totalPoints


today = datetime.now();
today = datetime(today.year, today.month, today.day) - timedelta(days=2);

#n_hours_before = today - timedelta(hours=hrs);
print today.strftime("%y/%m/%d,%H:%M:%S")

submitTime = today;



req = ""
while (totalPoints > 0):
	battVolt = random.uniform(12.0, 14.2);
	battCur = random.uniform(-3, 4);

	req = "?time=" + submitTime.strftime("%y/%m/%d,%H:%M:%S")
	req += "&battVolt=" + "{0:.2f}".format(battVolt)
	req += "&battCur=" + "{0:.2f}".format(battCur)

	totalPoints -= 1;
	submitTime += timedelta(minutes=interval)
	doRequest(req)



