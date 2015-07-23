/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */
/* exported addExplicitTest, addTest, createLineChart, doGetUserMedia, reportInfo, expectEquals, testFinished, setTestProgress, audioContext, reportSuccess, reportError, settingsDialog, setTimeoutWithProgressBar, reportWarning */
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

// TODO(andresp): Pass Test object to test instead of using global methods.
var currentTest;
function reportSuccess(str) { currentTest.reportSuccess(str); }
function reportError(str) { currentTest.reportError(str); }
function reportFatal(str) { currentTest.reportFatal(str); }
function reportWarning(str) { currentTest.reportWarning(str); }
function reportInfo(str) { currentTest.reportInfo(str); }
function setTestProgress(value) { currentTest.setProgress(value); }
function testFinished() { currentTest.done(); }
function expectEquals() { currentTest.expectEquals.apply(currentTest,
                                                         arguments); }

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

function createLineChart() {
  var chart = document.createElement('line-chart');
  currentTest.output_.appendChild(chart);
  currentTest.output_.opened = true;
  return chart;
}

function setTimeoutWithProgressBar(timeoutCallback, timeoutMs) {
  var start = window.performance.now();
  var updateProgressBar = setInterval(function() {
    var now = window.performance.now();
    setTestProgress((now - start) * 100 / timeoutMs);
  }, 100);

  var timeoutTask = function() {
    clearInterval(updateProgressBar);
    setTestProgress(100);
    timeoutCallback();
  };
  var timer = setTimeout(timeoutTask, timeoutMs);
  var finishProgressBar = function() {
    clearTimeout(timer);
    timeoutTask();
  };
  return finishProgressBar;
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
