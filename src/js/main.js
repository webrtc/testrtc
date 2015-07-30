/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */
/* exported addExplicitTest, addTest, audioContext */
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
  // Non-existent suite create and attach to #content.
  var suite = document.createElement('testrtc-suite');
  suite.name = suiteName;
  suite.addTest(testName, func);
  testSuites.push(suite);
  document.getElementById('content').appendChild(suite);
}

// Add a test that only runs if it is explicitly enabled with
// ?test_filter=<TEST NAME>
function addExplicitTest(suiteName, testName, func) {
  if (testIsExplicitlyEnabled(testName)) {
    addTest(suiteName, testName, func);
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

var parameters = parseUrlParameters();
var filterParameterName = 'test_filter';
if (filterParameterName in parameters) {
  testFilters = parameters[filterParameterName].split(',');
}
