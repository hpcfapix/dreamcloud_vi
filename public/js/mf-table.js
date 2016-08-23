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

$(document).ready(function(){
    $('#content').height($(window).height());

    $('#experimentTab').on('click', ' li a .close', function() {
        var tabId = $(this).parents('li').children('a').attr('href');
        $(this).parents('li').remove('li');
        $(tabId).remove();
        $('#experimentTab a:first').tab('show');
    });
});

function setSize() {
    $('iframe').each(function(index) {
        var frame = $(this);// $('iframe:eq(0)');
        var body = frame.contents().find('body');
        frame.css('height', '900px' );
        frame.css('width', '1100px' );
    });
}

function refresh() {
    console.log("refresh");
}

var app = angular.module('main', ['ngTable', 'ngResource'])

.controller('TableCtrl', function(
    $scope, $http, $filter, $q, $timeout, $resource, $window, ngTableParams) {

    $scope.visualize = function(user, task, id, job_id) {
        var nextTab = $('#experimentTab li').size() + 1;
        $('<li><a href="#tab' + nextTab +
            '" data-toggle="tab"><button class="close closeTab" type="button" >×</button>' + job_id + '</a></li>')
        .appendTo('#experimentTab');

        $('<div class="tab-pane" id="tab' + nextTab + '">' +
            '<iframe onload="setSize()" src="/mf/w3/visualization?user=' +
            user + '&task=' +  task + '&id=' + id + '" frameborder="0"></iframe></div>')
        .appendTo('.tab-content');

        $('#experimentTab a:last').tab('show');
    }

    $http.get('/mf/w3/experiments')
        .success(function(data, status) {
            $scope.data = data;

            $scope.users = function(column) {
                var def = $q.defer(),
                    arr = [],
                    users = [];
                angular.forEach($scope.data, function(item) {
                    if (inArray(item.user, arr) === -1) {
                        arr.push(item.user);
                        users.push({
                            'id': item.user,
                            'title': item.user
                        });
                    }
                });
                def.resolve(users);
                return def;
            };

            $scope.applications = function(column) {
                var def = $q.defer(),
                    arr = [],
                    applications = [];
                angular.forEach($scope.data, function(item) {
                    if (inArray(item.application, arr) === -1) {
                        arr.push(item.application);
                        applications.push({
                            'id': item.application,
                            'title': item.application
                        });
                    }
                });
                def.resolve(applications);
                return def;
            };

            $scope.tableParams = new ngTableParams({
                page:  1,
                count: 8,
                sorting: {
                    timestamp: 'desc'
                }
            }, {
                total: 0,
                getData: function($defer, params) {
                    var orderedData = params.sorting ?
                        $filter('orderBy')(data, params.orderBy()) :
                        data;

                    orderedData = params.filter ?
                        $filter('filter')(orderedData, params.filter()) :
                        orderedData;

                    $scope.users = orderedData.slice((params.page() - 1)
                        * params.count(), params.page()
                        * params.count());

                    $scope.apps = orderedData.slice((params.page() -1)
                        * params.count(), params.page()
                        * params.count());

                    params.total(orderedData.length);
                    $defer.resolve($scope.users);
                }
            });
        });

        var inArray = Array.prototype.indexOf ?
            function (val, arr) {
                return arr.indexOf(val)
            } :
            function (val, arr) {
                var i = arr.length;
                while (i--) {
                    if (arr[i] === val) return i;
                }
                return -1;
            }

        $scope.customUsers = function() {
            var def = $q.defer(),
                arr = [],
                names = [];
            $scope.data = "";
            $scope.$watch('data', function() {
                angular.forEach($scope.data, function(item) {
                    if (inArray(item.user, arr) === -1) {
                        arr.push(item.user);
                        names.push({
                            'id': item.user,
                            'title': item.user
                        });
                    }
                });
                names.sort(function (a, b) {
                    return (a['id'] > b['id'] ? 1 : -1);
                });
            });
            def.resolve(names);
            return def;
        }

        $scope.customApps = function() {
            var def = $q.defer(),
                arr = [],
                names = [];
            $scope.data = "";
            $scope.$watch('data', function() {
                angular.forEach($scope.data, function(item) {
                    if (inArray(item.application, arr) === -1) {
                        arr.push(item.application);
                        names.push({
                            'id': item.application,
                            'title': item.application
                        });
                    }
                });
                names.sort(function (a, b) {
                    return (a['id'] > b['id'] ? 1 : -1);
                });
            });
            def.resolve(names);
            return def;
        }
})
