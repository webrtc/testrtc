/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
/* exported testSuiteName */
'use strict';

/*  In order to make strings easier to translate all test suite names should be
 *  added here.
 *  TODO: Add/create new file containing the remainder of strings like error
 *  messages and general information.
 */

// Enumerate test suite names.
function TestSuiteNames() {
  this.testSuites = {
    CAMERA: 'Camera',
    MICROPHONE: 'Microphone',
    NETWORK: 'Network',
    CONNECTIVITY: 'Connectivity',
    THROUGHPUT: 'Throughput'
  };
  return this.testSuites;
}

var testSuiteName = new TestSuiteNames();
