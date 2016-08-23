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

/** @brief Returns the names of nodes where an experiment was executed on
 *
 * For a given experiment ID, this GET request return an array of hostnames,
 * where an agent was deployed during execution in order to fetch metric data.
 * This function is, for instance, used to fill the drop-down menu within the
 * visualization page.
 *
 * @param req the request object
 * @param res the response object
 *
 * @return a JSON document including hostnames
 */
router.get('/', function(req, res) {
    var user = req.query.user.toLowerCase(),
        task = req.query.task.toLowerCase(),
        id = req.query.id,
        max_num_hosts = 3,
        client = req.app.get('elastic');

    var index = user + '_' + task;

    /*
     * first, determine the number of available samples
     */
    client.count({
        index: index,
        type: id
    }, function(error, response) {
        var count = 2000;
        if (response != undefined) {
            if (response.count >= 10000) {
                count = 10000;
            } else {
                count = response.count;
            }
        }

        /*
         * get all available samples, and retrieve individual hostnames
         */
        client.search({
            index: index,
            type: id,
            size: count,
            sort: [ "@timestamp:desc" ]
        }, function(err, result) {
            if (err) {
                res.send(err);
            } else {
                var hostnames = [];
                if (result.hits != undefined) {
                    var only_results = result.hits.hits;
                    var keys = Object.keys(only_results);

                    keys.reverse().every(function(key) {
                        var data = only_results[key]._source;
                        var hostname = data.host;
                        if (hostnames.length == max_num_hosts) {
                            return false;
                        } else if (hostname != undefined && hostnames.indexOf(hostname) < 0) {
                            /*
                             * add hostnames to a set
                             */
                            hostnames.push(hostname);
                            return true;
                        } else {
                            return true;
                        }
                    });
                    /*
                     * return hostnames
                     */
                    res.send(hostnames);
                } else {
                    res.send('No hostname in the DB');
                }
            }
        });

    });
});

module.exports = router;