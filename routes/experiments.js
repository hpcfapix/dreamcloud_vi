/*
 * Copyright (C) 2014-2015 University of Stuttgart
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var express = require('express');
var router = express.Router();
var date_format = require('dateformat');

function is_defined(variable) {
    return (typeof variable !== 'undefined');
}

router.get('/', function(req, res, next) {
    var client = req.app.get('elastic'),
      query = '{ "query": { "match_all": {} } }',
      json = {},
      size = 1000;

    client.search({
        index: 'mf',
        type: 'experiments',
        searchType: 'count'
    }, function(error, response) {
        if (response.hits != undefined) {
            size = response.hits.total;
        }

        client.search({
            index: 'mf',
            type: 'experiments',
            body: query,
            size: size,
            sort: '@timestamp:desc'
        }, function(error, response) {
            if (response.hits != undefined) {
                var results = response.hits.hits;
                json = get_details(results);
            } else {
                json.error = 'No data found in the database.';
            }
            res.json(json);
        });
    });
});

function is_defined(variable) {
    return (typeof variable !== 'undefined');
}

function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

function get_details(results) {
    var keys = Object.keys(results),
      item = {},
      response = [];
    keys.forEach(function(key) {
        item = results[key]._source;
        if (isEmpty(item)) {
            return;
        }

        /* update time format */
        item.id = results[key]._id;
        item.timestamp = date_format(item['@timestamp'], "yyyy/mm/dd' 'HH:MM", true);
        delete item['@timestamp'];

        /* set missing job id */
        if (!is_defined(item.job_id)) {
            item.job_id = 'n/a';
        }
        response.push(item);
    });

    return response;
}

/*
 * variable used by /visualization
 */
var skip_fields = ['Timestamp', 'type', 'hostname'];

/** @brief Returns the actual sampled data for a given experiment ID
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return a JSON array with metric data
 */
router.get('/executions/:ID', function(req, res, next) {
    var client = req.app.get('elastic');

    var from_time = req.params.from;
    var to_time = req.params.to;
    var result_size = 1000;
    if (req.query.size) {
        result_size = req.query.size;
    }

    client.search({
        index: req.params.ID.toLowerCase(),
        size: result_size,
        sort: ["type", "Timestamp"],
    }, function(err, result) {
        if (err) {
            console.log('Error searching for the values of a specific benchmark: ' + err);
            res.send(err);
        } else {
            if (result.hits != undefined) {
                var only_results = result.hits.hits;
                var es_result = [];
                var keys = Object.keys(only_results);
                var power_result = {};

                keys.forEach(function(key) {
                    var data = only_results[key]._source;
                    /*
                     * if metric is from external power measurement system, then
                     * we have to do some more pre-processing. otherwise, we
                     * just add the metric data to our response
                     */
                    if (data.type != "power") {
                        es_result.push(data);
                        return;
                    }

                    var processed = false;
                    for (var key in data) {
                        if (processed)
                            return;
                        if (data.hasOwnProperty(key)) {
                            if (skip_fields.indexOf(key) > -1 || key == '')
                                continue;
                            /*
                             * parse and simplify time-stamp
                             * step is required to be compatible with Rickshaw
                             */
                            var value = parseInt(data[key]);
                            var time = data['Timestamp']; // 1430646029.762737460
                            time = time.toString();
                            time = time.substring(0, 13); // 1430646029.76
                            var metrics = power_result[time];
                            if (!metrics) {
                                metrics = {};
                                metrics.Timestamp = time;
                                metrics.type = data.type;
                            }
                            metrics[key] = value;
                            power_result[time] = metrics;
                            processed = true;
                        }
                    }
                });
                /*
                 * now, add the updated power metrics
                 */
                for (var key in power_result) {
                    es_result.push(power_result[key]);
                }
                res.json(es_result);
            } else {
                res.send('No data in the DB');
            }
        }
    })
});


/** @brief Returns the runtime for a given experiment ID
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return runtime information of a given experiment
 */
router.get('/executions/:ID/time', function(req, res, next) {
    var client = req.app.get('elastic');

    /*
     * get the earliest time-stamp by sorting in ascending order
     */
    client.search({
        index: req.params.ID.toLowerCase(),
        size: 1,
        sort: ["Timestamp:asc"],
    }, function(err, result) {
        var start;
        var end;

        if (err) {
            console.log('Error searching for the values of a specific benchmark: ' + err);
        } else {
            if (result.hits != undefined) {
                var only_results = result.hits.hits;
                var keys = Object.keys(only_results);
                keys.forEach(function(key) {
                    var metric_data = only_results[key]._source;
                    start = metric_data.Timestamp;
                });
            }
        }

        /*
         * get the latest time-stamp by sorting in descending order
         */
        client.search({
            index: req.params.ID.toLowerCase(),
            size: 1,
            sort: ["Timestamp:desc"],
        }, function(err, result) {
            var response;
            if (err) {
                console.log('Error searching for the values of a specific benchmark: ' + err);
            } else {
                if (result.hits != undefined) {
                    var only_results = result.hits.hits;
                    var keys = Object.keys(only_results);
                    keys.forEach(function(key) {
                        var metric_data = only_results[key]._source;
                        end = metric_data.Timestamp;
                    });
                }
            }

            /*
             * create response object
             */
            var response = '{ "start": ' + start + ', "end": ' + end + ', "duration": ' + (end - start) + ' }';
            res.send(response);
        });
    });
});

/** @brief Return details for a given experiment
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return details about an experiment as shown on the front-page
 */
router.get('/executions/details/:ID', function(req, res, next) {
    var client = req.app.get('elastic');

    client.get({
        index: 'executions',
        type: 'TBD',
        id: req.params.ID
    }, function(err, result) {
        if (result.found != false) {
            res.send(result._source);
        } else {
            res.send('Requested resource was Not found');
        }
    });
});

/** @brief Return all available metrics sampled for a given experiment
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return list of sampled metrics
 */
router.get('/executions/metrics/:ID', function(req, res, next) {
    var client = req.app.get('elastic');

    var id = req.params.ID.toLowerCase();
    client.indices.getMapping({
            index: req.params.ID.toLowerCase(),
        },
        function(err, result) {
            if (err) {
                console.log('Error searching metrics of a specific execution: ' + err);
                res.send(err);
            } else {
                var metrics = result[id].mappings.TBD.properties;
                var names = [];
                var metric_name = Object.keys(metrics);
                metric_name.forEach(function(metric) {
                    if (metric != "Timestamp" && metric != "type") {
                        names.push(metric);
                    }
                });
                res.send(names);
            }
        })
});

/** @brief Returns basic statistics for a given experiment, metric, and time interval
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return JSON document having statistics such as standard deviation
 */
router.get('/execution/stats/:ID/:metric/:from/:to', function(req, res, next) {
    var client = req.app.get('elastic');

    var metric_name = req.params.metric;
    var from_time = req.params.from;
    var to_time = req.params.to;

    client.search({
        index: req.params.ID.toLowerCase(),
        size: 0,
        body: {
            aggs: {
                range_metric: {
                    filter: {
                        range: {
                            "Timestamp": {
                                "from": from_time,
                                "to": to_time
                            }
                        }
                    },
                    aggs: {
                        "extended_stats_metric": {
                            extended_stats: {
                                "field": metric_name
                            }
                        }
                    }
                }
            }
        }
    }, function(err, result) {
        if (err) {
            console.log('Error doing statistics of a metric of a specific execution: ' + err);
            res.send(err);
            //res.status(500);
            //return next(err);
        } else {
            if (result.hits != undefined) {
                var only_results = result.aggregations.range_metric.extended_stats_metric;
                res.send(only_results);
            } else {
                res.send('Getting statistics of a metric of an execution failed.');
            }
        }
    })
});

/** @brief Filters sampled data based on given time interval
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return same as /executions/:ID
 */
router.get('/executions/:ID/:from/:to', function(req, res, next) {
    var client = req.app.get('elastic');

    var from_time = req.params.from;
    var to_time = req.params.to;

    client.search({
        index: req.params.ID.toLowerCase(),
        body: {
            query: {
                constant_score: {
                    filter: {
                        range: {
                            "Timestamp": {
                                "from": from_time,
                                "to": to_time
                            }
                        }
                    }
                }
            }
        }
    }, function(err, result) {
        if (err) {
            console.log('Error filtering sampled data based on given time interval: ' + err);
            res.send(err);
            //res.status(500);
            //return next(err);
        } else {
            if (result.hits != undefined) {
                var only_results = result.hits.hits;
                var es_result = [];
                var keys = Object.keys(only_results);
                keys.forEach(function(key) {
                    es_result.push(only_results[key]._source);
                });
                res.send(es_result);
            } else {
                res.send('Getting data based on given time interval failed.');
            }
        }
    });
});

module.exports = router;
