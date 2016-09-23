import urllib2
import random
from datetime import datetime, timedelta

def doRequest(urlReq):
	response = urllib2.urlopen('http://localhost:5000/data' + urlReq)
	html = response.read()
	print html

hrs = 24 * 30	# one month
interval = 15	# minutes

totalPoints = (60/interval * hrs)
print "total points:", totalPoints


today = datetime.now();
n_hours_before = today - timedelta(hours=hrs);
print today.strftime("%y/%m/%d,%H:%M:%S")
print n_hours_before.strftime("%y/%m/%d,%H:%M:%S")

submitTime = n_hours_before;



req = ""
battVolt = random.uniform(12.2, 14.6)
battCur = random.uniform(0, 4);


while (totalPoints > 0):
	battVolt += random.uniform(-0.2, 0.2);
	battCur += random.uniform(-0.2, 0.2);

	if (battVolt < 12):
		battVolt = 12.01;
	elif (battVolt > 14.6):
		battVolt = 14.59;

	if (battCur < 0):
		battCur = 0.01;
	elif (battCur > 4):
		battCur = 3.99;

	req = "?time=" + submitTime.strftime("%y/%m/%d,%H:%M:%S")
	req += "&battVolt=" + "{0:.2f}".format(battVolt)
	req += "&battCur=" + "{0:.2f}".format(battCur)

	totalPoints -= 1;
	submitTime += timedelta(minutes=interval)
	doRequest(req)





