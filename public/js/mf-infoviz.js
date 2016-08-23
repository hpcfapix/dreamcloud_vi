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

Rickshaw.namespace('Rickshaw.Fixtures.Number');

Rickshaw.Fixtures.Number.formatSeconds = function(y) {
    var abs_y = Math.abs(y);
    if (abs_y === 0)         { return '0' }
    else                     { return y + "s"}
};
