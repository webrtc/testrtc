/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';
/* exported addExplicitTest, addTest */

var enumeratedTestSuites = [];
var enumeratedTestFilters = [];

function addTest(suiteName, testName, func) {
  if (isTestDisabled(testName)) {
    return;
  }

  for (var i = 0; i !== enumeratedTestSuites.length; ++i) {
    if (enumeratedTestSuites[i].name === suiteName) {
      enumeratedTestSuites[i].addTest(testName, func);
      return;
    }
  }
  // Non-existent suite create and attach to #content.
  var suite = document.createElement('testrtc-suite');
  suite.name = suiteName;
  suite.addTest(testName, func);
  enumeratedTestSuites.push(suite);
  document.getElementById('content').appendChild(suite);
}

// Add a test that only runs if it is explicitly enabled with
// ?test_filter=<TEST NAME>
function addExplicitTest(suiteName, testName, func) {
  if (isTestExplicitlyEnabled(testName)) {
    addTest(suiteName, testName, func);
  }
}

function isTestDisabled(testName) {
  if (enumeratedTestFilters.length === 0) {
    return false;
  }
  return !isTestExplicitlyEnabled(testName);
}

function isTestExplicitlyEnabled(testName) {
  for (var i = 0; i !== enumeratedTestFilters.length; ++i) {
    if (enumeratedTestFilters[i] === testName) {
      return true;
    }
  }
  return false;
}

var parameters = parseUrlParameters();
var filterParameterName = 'test_filter';
if (filterParameterName in parameters) {
  enumeratedTestFilters = parameters[filterParameterName].split(',');
}
