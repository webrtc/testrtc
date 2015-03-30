/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */
/* exported addExplicitTest, addTest, createLineChart, doGetUserMedia, reportInfo, expectEquals, testFinished, setTestProgress, audioContext, reportSuccess, reportError, settingsDialog, setTimeoutWithProgressBar */
'use strict';

// Global WebAudio context that can be shared by all tests.
// There is a very finite number of WebAudio contexts.
try {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  var audioContext = new AudioContext();
} catch (e) {
  console.log('Failed to instantiate an audio context, error: ' + e);
}
var contentDiv = document.getElementById('content');
var startButton = document.getElementById('start-button');
var audioSelect = document.querySelector('select#audioSource');
var videoSelect = document.querySelector('select#videoSource');
var settingsDialog = document.getElementById('settings-dialog');
var PREFIX_INFO    = '[   INFO ]';
var PREFIX_OK      = '[     OK ]';
var PREFIX_FAILED  = '[ FAILED ]';
var testSuites = [];
var testFilters = [];
var currentTest;

document.querySelector('gum-dialog').addEventListener('closed', function() {
  if (typeof MediaStreamTrack.getSources === 'undefined') {
    console.log('getSources is not supported, device selection not possible.');
  } else {
    MediaStreamTrack.getSources(gotSources);
  }
  startButton.removeAttribute('disabled');
});

startButton.addEventListener('click', function() {
  startButton.setAttribute('disabled', null);
  runAllSequentially(testSuites, function() {
    startButton.removeAttribute('disabled');
  });
});

document.addEventListener('test-started', function() {
  startButton.setAttribute('disabled', null);
});

document.addEventListener('test-completed', function(event) {
  startButton.removeAttribute('disabled');
  event.isSomeTestRunning = false;
});

// A test suite is a composition of many tests.
function TestSuite(name, output) {
  this.name = name;
  this.tests = [];

  // UI elements.
  this.toolbar_ = document.createElement('core-toolbar');
  this.toolbar_.setAttribute('class', 'test-suite');
  this.toolbar_.setAttribute('state', 'pending');
  this.toolbar_.addEventListener('click', this.onClickToolbar_.bind(this));

  var title = document.createElement('span');
  title.setAttribute('flex', null);
  title.textContent = name;
  this.toolbar_.appendChild(title);

  this.statusIcon_ = document.createElement('core-icon');
  this.statusIcon_.setAttribute('icon', '');
  this.toolbar_.appendChild(this.statusIcon_);

  this.content_ = document.createElement('core-collapse');
  if (this.name === 'Manual') {
    this.content_.opened = true;
  }

  output.appendChild(this.toolbar_);
  output.appendChild(this.content_);
}

TestSuite.prototype = {
  addTest: function(testName, testFunction) {
    document.addEventListener('polymer-ready', function() {
      this.tests.push(new Test(this, testName, testFunction));
    }.bind(this));
  },

  run: function(doneCallback) {
    this.content_.opened = true;
    this.toolbar_.setAttribute('state', 'pending');
    this.statusIcon_.setAttribute('icon', 'more-horiz');
    runAllSequentially(this.tests, this.allTestFinished.bind(this,
                                                             doneCallback));
  },

  allTestFinished: function(doneCallback) {
    var errors = 0;
    var successes = 0;
    for (var i = 0; i !== this.tests.length; ++i) {
      successes += this.tests[i].successCount;
      errors += this.tests[i].errorCount;
    }

    if (errors === 0 && successes > 0) {
      this.toolbar_.setAttribute('state', 'success');
      this.statusIcon_.setAttribute('icon', 'check');
      this.content_.opened = false;
    } else {
      this.toolbar_.setAttribute('state', 'failure');
      this.statusIcon_.setAttribute('icon', 'close');
      this.content_.opened = true;
    }
    doneCallback();
  },

  onClickToolbar_: function() {
    this.content_.toggle();
  }
};

function Test(suite, name, func) {
  this.suite = suite;
  this.name = name;
  this.func = func;

  this.testCase = document.createElement('manual-test');
  this.testCase.addTestCase(this);
  suite.content_.appendChild(this.testCase);

  this.statusIcon_ = this.testCase.statusIcon;
  this.progressBar_ = this.testCase.progressBar;
  this.output_ = this.testCase.output;
  this.isTestRunning = function(status) {
    this.testCase.setState(status);
  };

  this.successCount = 0;
  this.errorCount = 0;
  this.doneCallback_ = null;

  this.isDisabled = testIsDisabled(name);
  this.reportMessage_(PREFIX_INFO, 'Test not run yet.');
}

Test.prototype = {
  run: function(doneCallback) {
    this.successCount = 0;
    this.errorCount = 0;
    this.doneCallback_ = doneCallback;
    this.testCase.clearMessages();
    this.setProgress(null);
    this.traceTestEvent = report.traceEventAsync('test-run');

    currentTest = this;
    this.traceTestEvent({name: this.name, status: 'Running'});
    if (!this.isDisabled) {
      this.testCase.setState('started');
      this.func();
    } else {
      this.reportInfo('Test is disabled.');
      this.done();
    }
  },

  done: function() {
    this.setProgress(null);
    var success = (this.errorCount === 0 && this.successCount > 0);
    var statusString = (success ? 'Success' :
                       (this.isDisabled ? 'Disabled' : 'Failure'));
    this.traceTestEvent({status: statusString});
    report.logTestRunResult(this.name, statusString);
    if (success) {
      this.testCase.setState('success');
    } else {
      this.testCase.setState('failure');
    }
    this.doneCallback_();
  },

  setProgress: function(value) {
    var bar = this.progressBar_;
    var statusIcon = this.statusIcon_;
    if (value !== null) {
      bar.style.display = 'block';
      bar.setAttribute('value', value);
      statusIcon.style.display = 'none';
    } else {
      bar.style.display = 'none';
      statusIcon.style.display = 'block';
    }
  },

  expectEquals: function(expected, actual, failMsg, okMsg) {
    if (expected !== actual) {
      this.reportError('Failed expectation: ' + expected + ' !== ' + actual +
                       ': ' + failMsg);
    } else if (okMsg) {
      this.reportSuccess(okMsg);
    }
  },

  reportSuccess: function(str) {
    this.reportMessage_(PREFIX_OK, str);
    this.successCount++;
    this.traceTestEvent({success: str});
  },

  reportError: function(str) {
    this.reportMessage_(PREFIX_FAILED, str);
    this.errorCount++;
    this.traceTestEvent({error: str});
  },

  reportInfo: function(str) {
    this.reportMessage_(PREFIX_INFO, str);
    this.traceTestEvent({info: str});
  },

  reportFatal: function(str) {
    this.reportError(str);
    this.done();
  },

  reportMessage_: function(prefix, str) {
    var message = document.createElement('div');
    message.textContent = prefix + ' ' + str;
    this.output_.appendChild(message);
  }
};

// TODO(andresp): Pass Test object to test instead of using global methods.
function reportSuccess(str) { currentTest.reportSuccess(str); }
function reportError(str) { currentTest.reportError(str); }
function reportFatal(str) { currentTest.reportFatal(str); }
function reportInfo(str) { currentTest.reportInfo(str); }
function setTestProgress(value) { currentTest.setProgress(value); }
function testFinished() { currentTest.done(); }
function expectEquals() { currentTest.expectEquals.apply(currentTest,
                                                         arguments); }

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
  var testSuite = new TestSuite(suiteName, contentDiv);
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
    // Exclude manual tests.
    if (tasks[current].name !== 'Manual') {
      tasks[current].run(runNextAsync);
      return;
    }
    runNextAsync();
  }
}

function doGetUserMedia(constraints, onSuccess, onFail) {
  var traceGumEvent = report.traceEventAsync('getusermedia');

  // Call into getUserMedia via the polyfill (adapter.js).
  var successFunc = function(stream) {
    var cam = getVideoDeviceName_(stream);
    var mic = getAudioDeviceName_(stream);
    traceGumEvent({'status': 'success', 'camera': cam, 'microphone': mic});
    onSuccess.apply(this, arguments);
  };
  var failFunc = function(error) {
    traceGumEvent({'status': 'fail', 'error': error});
    if (onFail) {
      onFail.apply(this, arguments);
    } else {
      reportFatal('Failed to get access to local media due to error: ' +
                  error.name);
    }
  };
  try {
    // Append the constraints with the getSource constraints.
    appendSourceId(audioSelect.value, 'audio', constraints);
    appendSourceId(videoSelect.value, 'video', constraints);

    traceGumEvent({'status': 'pending', 'constraints': constraints});
    getUserMedia(constraints, successFunc, failFunc);
  } catch (e) {
    traceGumEvent({'status': 'exception', 'error': e.message});
    return reportFatal('getUserMedia failed with exception: ' + e.message);
  }
}

function appendSourceId(id, type, constraints) {
  if (constraints[type] === true) {
    constraints[type] = {optional: [{sourceId: id}]};
  } else if (typeof constraints[type] === 'object') {
    if (typeof constraints[type].optional === 'undefined') {
      constraints[type].optional = [];
    }
    constraints[type].optional.push({sourceId: id});
  }
}

function gotSources(sourceInfos) {
  for (var i = 0; i !== sourceInfos.length; ++i) {
    var sourceInfo = sourceInfos[i];
    var option = document.createElement('option');
    option.value = sourceInfo.id;
    appendOption(sourceInfo, option);
  }
}

function appendOption(sourceInfo, option) {
  if (sourceInfo.kind === 'audio') {
    option.text = sourceInfo.label || 'microphone ' + (audioSelect.length + 1);
    audioSelect.appendChild(option);
  } else if (sourceInfo.kind === 'video') {
    option.text = sourceInfo.label || 'camera ' + (videoSelect.length + 1);
    videoSelect.appendChild(option);
  } else {
    console.log('Some other kind of source');
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

// Return the first audio device label on the track.
function getAudioDeviceName_(stream) {
  if (stream.getAudioTracks().length === 0) {
    return null;
  }
  return stream.getAudioTracks()[0].label;
}

// Return the first video device label on the track.
function getVideoDeviceName_(stream) {
  if (stream.getVideoTracks().length === 0) {
    return null;
  }
  return stream.getVideoTracks()[0].label;
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
