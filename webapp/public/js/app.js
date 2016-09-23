angular.module("contactsApp", ['ngRoute'])
    .config(function($routeProvider) {
        $routeProvider
            .when("/dashboard", {
                templateUrl: "livedata.html",
                controller: "ChartController",
                resolve: {
                    charts: function(Monitor) {
                        return Monitor.getCharts();
                    },
                    names: function(Monitor) {
                        return Monitor.getNames();
                    }
                }
            })
            .when("/help", {
                controller: "HelpController",
                templateUrl: "contact-form.html"
            })
            .otherwise({
                redirectTo: "/dashboard"
            })
    })
    .factory('socket', ['$rootScope', function($rootScope) {
        var socket = io.connect();

        return {
            on: function(eventName, callback) {
                socket.on(eventName, callback);
            }
        };
    }])
    .service("Monitor", function($http) {

        this.getYesterdayVoltage = function() {
            return $http.get("/fetchData/battVolt/all").
                then(function(response) {
                    return response;
                }, function(response) {
                    alert("Error getting todays voltages.")
            });
        }

        this.getCharts = function() {
            return $http.get("/charts").
                then(function(response) {
                    return response;
                }, function(response) {
                    alert("Error getting charts json.")
                });
        }

        this.getNames = function() {
            return $http.get("/dataNames").
                then(function(response) {
                    return response;
                }, function(response) {
                    alert("Error getting data names.")
                });
        }
        this.saveDataEntry = function(entry) {
            var url = "/dataNames";
            console.log(entry);
            return $http.post(url, entry).
            then(function(response) {
                    return response;
                }, function(response) {
                    if (response.status === 400) {
                        return false;
                    }
                    alert("Error posting response.");
                });
        }

        this.editDataEntry = function(entry) {
            var url = "/dataNames/" + entry._id;
            console.log(entry);

            var patch = {dataCol: entry.dataCol, displayName: entry.displayName};

            return $http.patch(url, patch).
            then(function(response) {
                    return response;
                }, function(response) {
                    if (response.status === 400) {
                        return false;
                    }
                    alert("Error editing data.")
                });
        }

        this.deleteName = function(id) {
            var url = "/dataNames/" + id;
            return $http.delete(url).
                then(function(response) {
                    return response;
                }, function(response) {
                    alert("Error deleting this id.");
                    console.log(response);
                });
        }

        this.deleteChart = function(id) {
            var url = "/charts/" + id;
            return $http.delete(url).
                then(function(response) {
                    return response;
                }, function(response) {
                    alert("Error deleting this chart.");
                    console.log(response);
                });
        }

        this.saveChartEntry = function(entry) {
            var url = "/charts";
            return $http.post(url, entry).
            then(function(response) {
                    return response;
                }, function(response) {
                    alert("Error posting response.");
                });
        }

        this.editChartEntry = function(entry) {
            var url = "/charts/" + entry._id;
            delete entry._id;
            return $http.patch(url, entry).
                then(function(response) {
                    return response
                }, function(response) {
                    alert("Error editing chart.")
                })
        }

        this.getChartData = function(dataCol, time, livePoints) {
            var url = "/fetchData/" + dataCol + "/" + time;
            if (time === 'live') {
                url += "/" + livePoints;
            }
            console.log(url);

            return $http.get(url).
                then(function(response) {
                    return response;
                }, function(response) {
                    alert("Error getting data for " + url);
                })
        }

        this.getChartUrl = function(dataCol, time, livePoints, id) {
            var url = "/fetchData/" + dataCol + "/" + time;
            if (time === 'live') {
                url += "/" + livePoints;
            }

            url += "?chartId=" + id;
            console.log(url);

            return $http.get(url);
        }
    })
    .controller("ChartController", function(charts, names, $scope, $q, Monitor, socket) {
        $scope.charts = charts.data;
        $scope.names = names.data;

        /* Scope Variables for DisplayName Modal */
        $scope.selectedName = null;
        $scope.isNewEntry = false;
        $scope.isEditing = false;
        $scope.errors = {name: false, col: false, duplicate: false, unsaved: false};
        $scope.newItem = null;

        /* Scope Variables for Charts Modal */
        $scope.selectedChart = null;
        $scope.isNewChart = false;
        $scope.isEditingChart = false;
        $scope.newChartItem = null;
        $scope.chartErrors = {title: false, data: false, time: false, livePoints: false};

        /* Scope Variable for Chart Data */
        $scope.chartData = [];
        var highchartObjects = {};

        socket.on('newData', function(result) {
            $scope.$apply(function(data) {
                console.log(result);
                console.log("-----------------------------");
                $scope.chartData.forEach(function(chart) {
                    console.log(chart);
                    if (chart.live && result[chart.dataCol] != undefined) {
                        console.log("Live: " + chart.chart_id + " " + chart.live);
                        console.log("Data: " + chart.dataCol);
                        console.log(result[chart.dataCol]);


                        var chartElement = angular.element(document.querySelector("#c" + chart.chart_id)).highcharts();
                        console.log("Data Size " + chartElement.series[0].data.length);
                        console.log("Num expected " + chart.livePoints);
                        if (chartElement.series[0].data.length < chart.livePoints) {
                            chartElement.series[0].addPoint([result.time, result[chart.dataCol]], true, false)
                        } else {
                            chartElement.series[0].addPoint([result.time, result[chart.dataCol]], true, true)
                        }
                    }

                    /*if (chart.live && data[chart.dataCol] !== undefined) {
                        console.log("Update " + chart.chart_id);
                    }*/
                    console.log(chart);
                });
            })
            //$scope.apply(function)
        });

        $scope.getTodayVoltage = function() {
            Monitor.getTodayBatteryVoltage().then(function(response) {
                $scope.voltage = response.data;
            }, function(reponse) {
                alert(response);
            });
        }

        $scope.getAllVoltage = function() {
            Monitor.getBatteryVoltage().then(function(response) {
                $scope.voltage = response.data;
            }, function(reponse) {
                alert(response);
            });
        }

        $scope.getYesterdayVoltage = function() {
            Monitor.getYesterdayVoltage().then(function(response) {
                $scope.voltage = response.data;
            }, function(reponse) {
                alert(response);
            });
        }

        $scope.setSelection = function(data) {
            console.log(data);
            $scope.selectedName = data;
            $scope.isEditing = false;
            $scope.isNewEntry = false;
            $scope.errors = {name: false, col: false, duplicate: false, unsaved: false};
        }

        $scope.deleteSelection = function() {
            console.log("Deleting " + $scope.selectedName.dataCol);
            if ($scope.selectedName._id === undefined) {
                $scope.names.pop();
                $scope.selectedName = null;
                $scope.isNewEntry = false;
                $scope.isEditing =  false;
                $scope.isDuplicateEntry = false;
            } else {
                Monitor.deleteName($scope.selectedName._id).then(function(response) {
                    $scope.selectedName = null;
                    $scope.isEditing = false;
                    $scope.isNewEntry = false;
                    $scope.isDuplicateEntry = false;
                    Monitor.getNames().then(function(response){
                        $scope.names = response.data;
                    });
                });
            }
        }

        $scope.editEntry = function() {
            $scope.isEditing = true;
        }

        $scope.saveEntry = function() {
            $scope.errors.unsaved = false;
            if ($scope.isNewEntry) {
                doSaveOrError();
            } else if ($scope.isEditing) {
                doEditOrError();
            }
        }

        $scope.newEntry = function() {
            if ($scope.isNewEntry || $scope.isEditing) {
                $scope.errors.unsaved = true;
            } else {
                $scope.newItem = {dataCol: "", displayName: ""};
                $scope.names.push($scope.newItem);
                $scope.selectedName = $scope.newItem;
                $scope.isNewEntry = true;
            }
        }

        $scope.$watch('selectedName.displayName', function() {
            $scope.errors.name = false;
        })

        $scope.$watch('selectedName.dataCol', function() {
            $scope.errors.col = false;
            $scope.errors.duplicate = false;
        })

        // this is triggered whenever a new item in the list is selected
        $scope.$watch('selectedName.$$hashKey', function(oldValue, newValue) {
            if ($scope.isNewEntry && $scope.selectedName === $scope.newItem) {
                console.log("same");
            } else if ($scope.isEditing) {
                console.log(oldValue);
                console.log(newValue);
                oldValue = $scope.editItem;
            } else {
                if ($scope.isNewEntry) {
                    $scope.names.pop();
                }
                $scope.isEditing = false;
                $scope.isNewEntry = false;
                $scope.errors = {name: false, col: false, duplicate: false, unsaved: false};
            }
        })

        $scope.$watch('selectedChart.dataCol', function() {
            $scope.chartErrors.dataCol = false;
        })

        $scope.$watch('selectedChart.title', function() {
            $scope.chartErrors.title = false;
        })

        $scope.$watch('selectedChart.time', function() {
            $scope.chartErrors.time = false;
        })

        $scope.$watch('selectedChart.livePoints', function() {
            $scope.chartErrors.livePoints = false;
        })


        function verifyFields() {
            var result = true;
            if ($scope.selectedName == null || $scope.selectedName.displayName == undefined 
                    || $scope.selectedName.displayName === "") {

                $scope.errors.name = true;
                result = false;
            }
            if ($scope.selectedName == null || $scope.selectedName.dataCol == undefined 
                    || $scope.selectedName.dataCol === "") {

                $scope.errors.col = true;
                result = false;
            }
            return result;
        }

        function verifyChartFields() {
            var result = true;
            if ($scope.selectedChart == null || $scope.selectedChart.title == undefined
                    || $scope.selectedChart.title === "") {

                    $scope.chartErrors.title = true;
                    result = false;
            }
            if ($scope.selectedChart == null || $scope.selectedChart.dataCol == undefined
                    || $scope.selectedChart.dataCol === "") {

                    $scope.chartErrors.dataCol = true;
                    result = false;
            }
            if ($scope.selectedChart == null || $scope.selectedChart.time == undefined
                    || $scope.selectedChart.time === "") {

                    $scope.chartErrors.time = true;
                    result = false;
            }
            if ($scope.selectedChart == null || $scope.selectedChart.livePoints === undefined
                    || $scope.selectedChart.livePoints === "" ) {

                    $scope.chartErrors.livePoints = true;
                    result = false;
            } else if (+$scope.selectedChart.livePoints > 250 || +$scope.selectedChart.livePoints < 10) {
                $scope.chartErrors.livePoints = true;
                result = false;
            }
            return result;
        }

        function doEditOrError() {
            if (verifyFields()) {
                Monitor.editDataEntry($scope.selectedName).then(function(response) {
                    if (response === false) {
                        $scope.errors.duplicate = true;
                    } else {
                        Monitor.getNames().then(function(response){
                            $scope.names = response.data;
                            resetScope();
                        });
                    }
                });
            }
        }

        function doSaveOrError() {
            if (verifyFields()) {
                Monitor.saveDataEntry($scope.selectedName).then(function(response) {
                    if (response === false) {
                        $scope.errors.duplicate = true;
                    } else {
                        Monitor.getNames().then(function(response){
                            $scope.names = response.data;
                            resetScope();
                        });
                    }
                });
            }
        }

        function resetScope() {
            $scope.isEditing = false;
            $scope.isNewEntry = false;
            $scope.errors = {name: false, col: false, duplicate: false};
            $scope.selectedName = null;
            $scope.newItem = null;
        }

        function resetChartScope() {
            $scope.selectedChart = null;
            $scope.isNewChart = false;
            $scope.isEditingChart = false;
            $scope.newChartItem = null;
            $scope.chartErrors = {title: false, data: false, time: false, livePoints: false};
        }

        /* Functions for chart management */
        $scope.deleteChart = function() {
            Monitor.deleteChart($scope.selectedChart._id).then(function(response) {
                    $scope.selectedChart = null;
                    Monitor.getCharts().then(function(response){
                        $scope.charts = response.data;
                    });
                });
        }

        $scope.newChart = function() {
            $scope.newChartItem = {dataCol: "", title: "", livePoints: 50, time:""};
            $scope.charts.push($scope.newChartItem);
            $scope.selectedChart = $scope.newChartItem;
            $scope.isNewChart = true;
        }

        $scope.editChart = function() {
            $scope.isEditingChart = true;
        }

        $scope.saveChart = function() {
            if ($scope.isEditingChart) {
                doSaveEditChart();
            } else if ($scope.isNewChart) {
                doSaveNewChart();
            }
        }

        function doSaveNewChart() {
            if (verifyChartFields()) {
                Monitor.saveChartEntry($scope.selectedChart).then(function (response) {
                    Monitor.getCharts().then(function (response) {
                        $scope.charts = response.data;
                        resetChartScope();
                    });
                });
            }
        }

        function doSaveEditChart() {
            if (verifyChartFields()) {
                Monitor.editChartEntry($scope.selectedChart).then(function(response) {
                    Monitor.getCharts().then(function (response) {
                        $scope.charts = response.data;
                        resetChartScope();
                    })
                })
            }
        }

        angular.element(document).ready(function() {
            //console.log(JSON.stringify($scope))
            loadAllChartData();
        })

        function loadAllChartData(callback) {
            var chartDataUrls = [];
            $scope.charts.forEach(function(entry) {
                chartDataUrls.push(generateChartRequest(entry));
                /*loadChartDataForEntry(entry, function(data){
                    $scope.chartData.push(data);
                    highchartObjects.push(generateHighChartObject(data));
                });*/
            })
            $q.all(chartDataUrls).then(function(results) {
                results.forEach(function(result) {
                    var result = result.data;
                    result.dataDisplayName = getDataDisplayName(result.dataCol);
                    result.title = getChartTitle(result.chart_id);

                    if (result.dataCol === "battVolt") {
                        result.y_min = 0;
                    }

                    if (result.dataCol.includes("Volt")) {
                        result.y_axis = "Volts"
                    } else {
                        result.y_axis = "Amps"
                    }

                    $scope.chartData.push(result);
                    highchartObjects[result.chart_id] = generateHighChartObject(result);
                    console.log(result)
                })
                console.log(highchartObjects);

                //draw each chart
                var mainChartsContainer = angular.element(document.querySelector("#charts"));
                $scope.chartData.forEach(function(chartData) {
                    //var chart = highchartObjects[0]
                    var chartGrid = document.createElement("div");
                    chartGrid.className = "chart col-xs-6 col-lg-6 grid-group-item"

                    var chart = highchartObjects[chartData.chart_id];

                    var chartElement = document.createElement("div");
                    chartElement.id = "c" + chart.chart.id;

                    chartGrid.appendChild(chartElement);
                    mainChartsContainer.append(chartGrid);
                    Highcharts.chart(chartElement, chart);
                })
            });
            }


        function getDataDisplayName(dataCol) {
            if ($scope.names != null) {
                for (var i = 0; i < $scope.names.length; i++) {
                    if ($scope.names[i].dataCol === dataCol) {
                        console.log("match")
                        return $scope.names[i].displayName;
                    }
                }
            }
            console.log("none")
            return dataCol;
        }

        function getChartTitle(chartId) {
            if ($scope.charts != null) {
                for (var i = 0; i < $scope.charts.length; i++) {
                    if ($scope.charts[i]._id === chartId) {
                        console.log("match")
                        return $scope.charts[i].title;
                    }
                }
            }
            console.log("none")
            return "";
        }

        function generateHighChartObject(chartData) {
            return chartObj = 
                {
                    chart: {
                        type: "spline",
                        id: chartData.chart_id
                    },
                    title: {
                        text: chartData.title
                    },
                    xAxis: {
                        type: 'datetime',
                        dateTimeLabelFormats: {
                          /*second: '%l:%M:%S %P',
                          minute: '%l:%M %P',
                          hour: '%l:%M %P',
                          day: '%b %e',
                          week: '%b %e',
                          month: '%b',
                          year: '%Y'*/
                          month: '%b %#d',
                          year: '%G'
                        },
                        title: {
                            text: 'Date'
                        }
                    },
                    yAxis: {
                        title: {
                            text: chartData.y_axis
                        },
                        min: chartData.y_min
                    },/*
                    tooltip: {
                      dateTimeLabelFormats: {
                          second: '%l:%M:%S %P',
                          minute: '%l:%M %P',
                          hour: '%l:%M %P',
                          day: '%b %e',
                          week: '%b %e',
                          month: '%b',
                          year: '%Y'
                        }
                    },*/
                    series: [{
                      name: chartData.dataDisplayName,
                        data: chartData.data
                    }]
                };
        }

        function loadChartDataForEntry(entry, callback) {
            Monitor.getChartData(entry.dataCol, entry.time, entry.livePoints).then(function(response) {
                var result = response.data;
                result["title"] = entry.title;
                result["dataDisplayName"] = getDataDisplayName(entry.dataCol);
                console.log(result);
                callback(result);
            });
        }

        function generateChartRequest(entry) {
            return Monitor.getChartUrl(entry.dataCol, entry.time, entry.livePoints, entry._id);
        }

        function resizeAllCharts() {
            $("[data-highcharts-chart]").each(function () {
                var highChart = Highcharts.charts[$(this).data('highchartsChart')];
                highChart.reflow();
            });
        }

        $scope.listClicked = function() {
            console.log("list");
            var chartElements = $('#charts .grid-group-item')
            chartElements.addClass('list-group-item');

            if (chartElements.length > 0) {
                resizeAllCharts();
            }
        }

        $scope.gridClicked = function() {
            console.log("grid");
            var gridElements = $('#charts .list-group-item')
            gridElements.removeClass('list-group-item');
            //$('#charts .chart').addClass('grid-group-item');
            if (gridElements.length > 0) {
                resizeAllCharts();
            }
        }
    });