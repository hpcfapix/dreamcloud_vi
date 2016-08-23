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
var request = require('request');
var router = express.Router();

function is_defined(variable) {
    return (typeof variable !== 'undefined');
}

/** @brief Downloading metric data either as JSON or CSV
 *
 * This GET request returns for a given experiment ID all available metric data
 * either as JSON or CSV.
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return metric data either formatted as JSON or CSV (a file)
 */
router.get('/:userId/:appId/:experimentId', function(req, res, next) {
    var client = req.app.get('elastic'),
        workflow = req.params.userId,
        task = req.params.appId,
        experiment = req.params.experimentId,
        data = [],
        size = 10000,
        json_format = req.query.json,
        csv_format = req.query.csv;

    /*
     * switch between CSV and JSON
     */
    if (is_defined(csv_format)) {
        res.setHeader('Content-disposition', 'attachment; filename=' +
            workflow + '_' + task + '_' + experiment + '.csv');
        res.setHeader('Content-type', 'text/plain');
    } else {
        res.setHeader('Content-disposition', 'attachment; filename=' +
            workflow + '_' + task + '_' + experiment + '.json');
        res.setHeader('Content-type', 'text/html');
    }
    res.charset = 'UTF-8';

    var index = workflow + '_' + task;
    index = index.toLowerCase()

    client.search({
        index: index,
        type: experiment,
        searchType: 'count'
    }, function(error, response) {
        if (error) {
            res.status(500);
            return next(error);
        }
        if (response.hits != undefined) {
            size = response.hits.total;
        }

        client.search({
            index: index,
            type: experiment,
            size: size
        }, function(error, response) {
            if (error) {
                res.status(500);
                return next(error);
            }
            if (response.hits !== undefined) {
                var results = response.hits.hits,
                    keys = Object.keys(results);
                keys.forEach(function(key) {
                    data.push(results[key]._source);
                });

                if (is_defined(csv_format)) {
                    data = JSON2CSV(data);
                    res.write(data);
                    res.end();
                    return;
                }

                res.write(JSON.stringify(data));
                res.end();
            } else {
                res.send("Error. Data not found.");
            }
        });
    });
});

/** @brief Converts JSON metric data to CSV format
 *
 * @param objArray metric data
 *
 * @return CSV formatted metric data
 */
function JSON2CSV(objArray) {
    var array = objArray;//JSON.parse(objArray);;
    var str = '';
    var line = '';
    var metric_type = '';

    for (var i = 0; i < array.length; i++) {
        line = '';
        if (metric_type != array[i]['type']) {
            metric_type = array[i]['type']
            for (var index in array[i]) {
                line += index + ',';
            }
            line = line.slice(0, -1);
            str += line + '\r\n';
        }
        line = '';

        for (var index in array[i]) {
            line += array[i][index] + ',';
        }
        line = line.slice(0, -1);
        str += line + '\r\n';
    }

    return str;
};

module.exports = router;
