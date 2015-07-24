/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */
/* exported addExplicitTest, addTest, createLineChart, doGetUserMedia, audioContext, settingsDialog */
'use strict';

// Global WebAudio context that can be shared by all tests.
// There is a very finite number of WebAudio contexts.
try {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  var audioContext = new AudioContext();
} catch (e) {
  console.log('Failed to instantiate an audio context, error: ' + e);
}

var testSuites = [];
var testFilters = [];

function _createSuite(name, output) {
  var element = document.createElement('testrtc-suite');
  element.name = name;
  output.appendChild(element);
  return element;
}

function addTest(suiteName, testName, func) {
  if (testIsDisabled(testName)) {
    return;
  }

  for (var i = 0; i !== testSuites.length; ++i) {
    if (testSuites[i].name === suiteName) {
      testSuites[i].addTest(testName, func);
      return;
    }
  }
  // Non-existent suite.
  var testSuite = _createSuite(suiteName, document.getElementById('content'));
  testSuite.addTest(testName, func);
  testSuites.push(testSuite);
}

// Add a test that only runs if it is explicitly enabled with
// ?test_filter=<TEST NAME>
function addExplicitTest(suiteName, testName, func) {
  if (testIsExplicitlyEnabled(testName)) {
    addTest(suiteName, testName, func);
  }
}

// Helper to run a list of tasks sequentially:
//   tasks - Array of { run: function(doneCallback) {} }.
//   doneCallback - called once all tasks have run sequentially.
function runAllSequentially(tasks, doneCallback) {
  var current = -1;
  var runNextAsync = setTimeout.bind(null, runNext);

  runNextAsync();

  function runNext() {
    current++;
    if (current === tasks.length) {
      doneCallback();
      return;
    }
    tasks[current].run(runNextAsync);
  }
}

function testIsDisabled(testName) {
  if (testFilters.length === 0) {
    return false;
  }
  return !testIsExplicitlyEnabled(testName);
}

function testIsExplicitlyEnabled(testName) {
  for (var i = 0; i !== testFilters.length; ++i) {
    if (testFilters[i] === testName) {
      return true;
    }
  }
  return false;
}

// Parse URL parameters and configure test filters.
function parseUrlParameters() {
  var output = {};
  // python SimpleHTTPServer always adds a / on the end of the request.
  // Remove it so developers can easily run testrtc on their machines.
  // Note that an actual / is still sent in most cases as %2F.
  var args = window.location.search.replace(/\//g, '').substr(1).split('&');
  for (var i = 0; i !== args.length; ++i) {
    var split = args[i].split('=');
    output[decodeURIComponent(split[0])] = decodeURIComponent(split[1]);
  }
  return output;
}

var parameters = parseUrlParameters();
var filterParameterName = 'test_filter';
if (filterParameterName in parameters) {
  testFilters = parameters[filterParameterName].split(',');
}
