var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var mongodb = require("mongodb");
var url = require("url");
var ObjectID = mongodb.ObjectID;

var CONTACTS_COLLECTION = "contacts";
var DATA_COLLECTION = "demoCollection";
var CHART_COLLECTION = "charts";
var NAMES_COLLECTION = "names";

var app = express();
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());

// Create a database variable outside of the database connection callback to reuse the connection pool in your app.
var db;

var HEROKU_MONGO = "mongodb://localhost"
var MAX_RECORDS = 250;

mongodb.MongoClient.connect(process.env.MONGOLAB_URI || HEROKU_MONGO, function (err, database) {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  // Save database object from the callback for reuse.
  db = database;
  console.log("Database connection ready");
});

  // Initialize the app.
var server = app.listen(process.env.PORT || 8080, function () {
  var port = server.address().port;
  console.log("App now running on port", port);
});
var io = require("socket.io")(server);


// Generic error handler used by all endpoints.
function handleError(reason, message, res) {
  console.log("ERROR: " + reason);
  res.status(500).json({"error": message});
}


// Helper function to take {time: 12345678, dataCol : 12.32}
// and transform it to [12345678, 12.32] for charting purposes
function handleDataPointCallback(err, dataPoints, dataCol, live, numPoints, chartId, res) {
  if (err) {
    handleError(err.message, "Failed to get data", res);
  } else {
    var respJSON = {};
    var data = [];
    for (i = (dataPoints.length - 1); i >= 0; i--){
        data.push([dataPoints[i]['time'], dataPoints[i][dataCol]]);
    }
    respJSON['data'] = data;
    respJSON['dataCol'] = dataCol;
    respJSON['live'] = live;
    respJSON['livePoints'] = numPoints;
    respJSON['chart_id'] = chartId;
    res.status(200).json(respJSON);
  }
}

function handleAverageDataPointCallback(err, dataPoints, dataCol, chartId, res) {
  if (err) {
    handleError(err.message, "Failed to get data", res);
  } else {
    var data = [];

    for (i = 0; i < dataPoints.length; i++) {
        dataPoint = dataPoints[i];
        hours = 0;
        if (dataPoint.date.hour != undefined) {
          hours = dataPoint.date.hour;
        }
        millis = Date.UTC(dataPoint.date.year, dataPoint.date.month - 1, dataPoint.date.day, hours, 0, 0);
        data.push([millis, Math.round(dataPoint[dataCol] * 100)/100]);
    }

    respJSON = {};
    respJSON['data'] = data;
    respJSON['dataCol'] = dataCol;
    respJSON['live'] = false;
    respJSON['livePoints'] = -1;
    respJSON['chart_id'] = chartId;
    res.status(200).json(respJSON);
  }
}

function handleDBCallback(err, data, avg, res) {
    if (err) {
      handleError(err.message, "Failed to get data", res);
    } else {
      var respJSON = {}
      respJSON['avg'] = avg;
      respJSON['data'] = data;
      res.status(200).json(respJSON);
    }
}

function getTodayMillis() {
  var date = new Date();
  date.setHours(0,0,0,0)
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 
                date.getHours(), date.getMinutes(), date.getSeconds());
}

function getYesterdayMillis() {
  var date = new Date();
  date.setHours(0,0,0,0);
  date.setDate(date.getDate() - 1)
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 
                date.getHours(), date.getMinutes(), date.getSeconds());
}

function isNumber(num) {
  return !isNaN(num)
}

function doMongoQueryToday(dataColumn, res, chartId) {
  var query = {time: {}}
  query["time"]["$exists"] = 1
  query["time"]["$gte"] = getTodayMillis();
  query[dataColumn] = {$exists: 1}

  var mongoRequest = createMongoQuery(dataColumn, query).limit(MAX_RECORDS);
  mongoRequest.toArray(function(err, docs) {
      handleDataPointCallback(err, docs, dataColumn, false, -1, chartId, res);
  });
}

function doMongoQueryYesterday(dataColumn, res, chartId) {
  var query = {time: {}}
  query["time"]["$exists"] = 1
  query["time"]["$gte"] = getYesterdayMillis();
  query["time"]["$lt"] = getTodayMillis();
  query[dataColumn] = {$exists: 1}

  var mongoRequest = createMongoQuery(dataColumn, query).limit(MAX_RECORDS);
  mongoRequest.toArray(function(err, docs) {
      handleDataPointCallback(err, docs, dataColumn, false, -1, chartId, res);
  });
}

// Helper function to get most recent data
function doMongoQueryLive(dataColumn, numPoints, res, chartId) {
  var query = {time: {}}
  query["time"]["$exists"] = 1
  query[dataColumn] = {$exists: 1}

  var mongoRequest = createMongoQuery(dataColumn, query).limit(numPoints);
  mongoRequest.toArray(function(err, docs) {
      handleDataPointCallback(err, docs, dataColumn, true, numPoints, chartId, res);
  });
}


function createMongoQuery(dataColumn, query) {
  // if there's no time, we cant do anything about it
  var include = {_id:0, time:1}
  include[dataColumn] = 1

  return db.collection(DATA_COLLECTION).find(query, include).sort({time : -1})
};

function doMongoQueryDailyAvg(dataColumn, res, chartId) {

  var group = {"$group" : {}}
  group["$group"]["_id"] =  {year : {"$year" : "$isodate"}, month: 
      {"$month": "$isodate"}, day: {"$dayOfMonth": "$isodate"}};

  group["$group"][dataColumn] = {}
  group["$group"][dataColumn]["$avg"] = "$" + dataColumn;

  var sort = {"$sort": {'_id.year': 1, '_id.month':1, '_id.day':1}} 

  var project = {"$project": {}}
  project["$project"]["date"] = "$_id";
  project["$project"][dataColumn] = 1;
  project["$project"]["_id"] = 0;

  var stages = [group, sort, project];

  return db.collection(DATA_COLLECTION).aggregate(stages).toArray(function(err, docs) {
    handleAverageDataPointCallback(err, docs, dataColumn, chartId, res);
  });
}

function doMongoQueryHourlyAvg(dataColumn, res, chartId) {

  var group = {"$group" : {}}
  group["$group"]["_id"] =  {year : {"$year" : "$isodate"}, month: 
      {"$month": "$isodate"}, day: {"$dayOfMonth": "$isodate"}, hour: {"$hour": "$isodate"}};

  group["$group"][dataColumn] = {}
  group["$group"][dataColumn]["$avg"] = "$" + dataColumn;

  var sort = {"$sort": {'date.year': 1, 'date.month':1, 'date.day':1, 'date.hour':1}} 

  var project = {"$project": {}}
  project["$project"]["date"] = "$_id";
  project["$project"][dataColumn] = 1;
  project["$project"]["_id"] = 0;

  var stages = [group, project, sort];

  return db.collection(DATA_COLLECTION).aggregate(stages).toArray(function(err, docs) {
    handleAverageDataPointCallback(err, docs, dataColumn, chartId, res);
  });
}

function doMongoQueryWeeklyAvg(dataColumn, res, chartId) {

  var initialSort = {"$sort": {'isodate': 1}} 

  var group = {"$group" : {}}
  group["$group"]["_id"] =  {year : {"$year" : "$isodate"}, month: 
      {"$month": "$isodate"}, /*day: {"$first" :{"$dayOfMonth": "$isodate"}},*/ week: {"$week": "$isodate"}};

  group["$group"][dataColumn] = {}
  group["$group"][dataColumn]["$avg"] = "$" + dataColumn;
  group["$group"]["day"]= {"$first" : {"$dayOfMonth": "$isodate"}}

  var sort = {"$sort": {'date.year': 1, 'date.month':1, 'date.day':1}} 

  var project = {"$project": {}}
  project["$project"]["date"] = {};
  project["$project"]["date"]["year"] = "$_id.year"
  project["$project"]["date"]["month"] = "$_id.month"
  project["$project"]["date"]["day"] = "$day"
  project["$project"][dataColumn] = 1;
  project["$project"]["_id"] = 0;

  var stages = [initialSort, group, project, sort];
  console.log(stages);

  return db.collection(DATA_COLLECTION).aggregate(stages).toArray(function(err, docs) {
    handleAverageDataPointCallback(err, docs, dataColumn, chartId, res);
  });
}

// this is backwards get doing a post but is much simpler
// for the client
app.get("/data", function(req, res) {
  //var reqJson = "{"
  var query = url.parse(req.url, true).query;

  for (var key in query) {
    var value = query[key]
    if (isNumber(value)) {
      query[key] = +value;
    }
  }

  // if there are parameters, then we're adding stuff
  if (query['time'] != null){

    // time in format yy/MM/dd,hh:mm:ss
    var datetime = query['time'];

    var date = datetime.split(",")[0]
    var time = datetime.split(",")[1]

    var dateSplit = date.split("/")
    var timeSplit = time.split(":")

    //for the year we only have a 2 digit year so it must be converted 
    var yr = +dateSplit[0]
    var year = yr + (yr < 16 ? 2100 : 2000)

    var d = Date.UTC(year, dateSplit[1] - 1, dateSplit[2], timeSplit[0], timeSplit[1], timeSplit[2])
    var isodate = new Date(d);
    console.log(d)

    query['time'] = d
    query['isodate'] = isodate

    db.collection(DATA_COLLECTION).insertOne(query, function(err, doc) {
      if (err) {
        handleError(err.message, "Failed to add data", res);
      } else {
        io.sockets.emit("newData", query)
        res.status(200).end("OK");
      }
    });
  } else {
    res.status(400).end("ERROR");
  }
});

app.delete("/alldata", function(req, res) {
  db.collection(DATA_COLLECTION).deleteMany({}, function(err, doc) {
    if (err) {
      handleError(err.message, "Failed to delete all", res);
    } else {
      res.status(200).end();
    }
  });
});

app.get("/alldata", function(req, res){
  db.collection(DATA_COLLECTION).find({}).toArray(function(err, docs) {
      handleDBCallback(err, docs, false, res)
    });
});

app.get("/voltage", function(req, res) {
  var query = url.parse(req.url, true).query;
  var time = query['time']
  if (time == "today" || time == "yesterday") {
    console.log(query['time']);
      var date = new Date();
      date.setHours(0, 0, 0, 0)
      console.log(date);
      date = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds());
      console.log(date);  
      if (time == "yesterday") {
        var yday = date - 1000*60*60*24;
        console.log(date)
        console.log(yday)
        db.collection(DATA_COLLECTION).find(
        {battVolt:{$exists:true}, time:{$gte: yday, $lt: date}}, 
        {_id:0, battVolt:1, time:1}).sort({time: 1}).toArray(function(err, docs) {
          if (err) {
            handleError(err.message, "Failed to get voltages", res);
          } else {
            res.status(200).json(docs);
          }
        });
      } else {
        db.collection(DATA_COLLECTION).find(
          {battVolt:{$exists:true}, time:{$gte: date}}, 
          {_id:0, battVolt:1, time:1}).sort({time: 1}).toArray(function(err, docs) {
            if (err) {
              handleError(err.message, "Failed to get voltages", res);
            } else {
              res.status(200).json(docs);
            }
          });
      }
  } else {
      db.collection(DATA_COLLECTION).find({}).sort({time : 1}).limit(150).toArray(function(err, docs) {
          if (err) {
            handleError(err.message, "Failed to get voltages", res);
          } else {
            res.status(200).json(docs);
          }
        });
  }
});

/* "/fetchData/:data/:time"
 *  GET: return "data" for the specified "time"
 *  Acceptable values for time: live, today, yesterday, hourly, daily, weekly
 *  NOTE: Each of these endpoints will return AT MOST MAX_RECORDS entries
 */
 app.get("/fetchData/:data/:time", function(req, res) {
    var queryData = req.params.data;
    var queryTime = req.params.time;

    var chartId = req.query.chartId;

    if (queryTime === "today") {
      doMongoQueryToday(queryData, res, chartId);
    } else if (queryTime === "yesterday") {
      doMongoQueryYesterday(queryData, res, chartId);
    } else if (queryTime === "hourly") {
      doMongoQueryHourlyAvg(queryData, res, chartId);
    } else if (queryTime === "daily") {
      doMongoQueryDailyAvg(queryData, res, chartId);
    } else if (queryTime === "weekly") {
      doMongoQueryWeeklyAvg(queryData, res, chartId);
    } else if (queryTime === "live") {
      doMongoQueryLive(queryData, 50, res, chartId);
    } else {
      res.status(404).end();
    }
 });

 /* "/fetchData/:data/live/:numPoints"
  *  GET: return most recent data up to numPoints
  */
 app.get("/fetchData/:data/live/:numPoints", function(req, res) {
    if (isNaN(req.params.numPoints)) {
      res.status(400).end();
    }

    var queryData = req.params.data;
    var queryPoints = +req.params.numPoints;

    var chartId = req.query.chartId;

    console.log("here")

    if (queryPoints > MAX_RECORDS) {
      res.status(400).end("Number of points cannot be greater than " + MAX_RECORDS);
    } else if (queryPoints < 10) {
      res.status(400).end("Must request at least 10 points");
    } else {
      doMongoQueryLive(queryData, queryPoints, res, chartId);
    }
 });

app.get("/charts", function(req, res) {
  db.collection(CHART_COLLECTION).find({}).toArray(function(err, docs) {
    if (err) {
      handleError(err.message, "Failed to get charts.", res);
    } else {
      res.status(200).json(docs);
    }
  });
});

app.post("/charts", function(req, res) {
  db.collection(CHART_COLLECTION).insertOne(req.body, function(err, docs) {
    if (err) {
      handleError(err.message, "Failed to post NAME", res);
    } else {
      res.status(201).json(docs.ops[0])
    }
  });
});

app.patch("/charts/:id", function(req, res) {
  db.collection(CHART_COLLECTION).update({_id: new ObjectID(req.params.id)}, {$set : req.body}, function(err, docs) {
    if (err) {
        handleError(err.message, "Failed to modify item", res);
    } else {
      res.status(200).end("OK");
    }
  })
});

app.delete("/charts/:id", function(req, res) {
  db.collection(CHART_COLLECTION).deleteOne({_id: new ObjectID(req.params.id)}, function(err, docs) {
    if (err) {
      handleError(err.message, "Failed to delete item", res);
    } else {
      res.status(200).end("OK");
    }
  })
});

app.get("/dataNames", function(req, res) {
  db.collection(NAMES_COLLECTION).find({}).toArray(function(err, docs) {
    if (err) {
      handleError(err.message, "Failed to get names.", res);
    } else {
      res.status(200).json(docs);
    }
  });
});

app.post("/dataNames", function(req, res) {
  db.collection(NAMES_COLLECTION).insertOne(req.body, function(err, docs) {
    if (err) {
      if (err.code === 11000) {
        res.status(400).json({})
      } else {
        handleError(err.message, "Failed to post NAME", res);
      }
    } else {
      res.status(201).json(docs.ops[0])
    }
  });
});

app.delete("/dataNames/:id", function(req, res) {
  db.collection(NAMES_COLLECTION).deleteOne({_id: new ObjectID(req.params.id)}, function(err, docs) {
    if (err) {
      handleError(err.message, "Failed to delete item", res);
    } else {
      res.status(200).end("OK");
    }
  })
})

app.patch("/dataNames/:id", function(req, res) {
  db.collection(NAMES_COLLECTION).update({_id: new ObjectID(req.params.id)}, {$set : req.body}, function(err, docs) {
    if (err) {
      if (err.code === 11000) {
        res.status(400).json({})
      } else {
        handleError(err.message, "Failed to modify item", res);
      }
    } else {
      res.status(200).end("OK");
    }
  })
})

